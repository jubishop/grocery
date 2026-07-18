import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { looseMeatMatches } from "../scripts/match-loose-meat.mjs";
import { looseProduceMatches } from "../scripts/match-loose-produce.mjs";
import {
  normalizeDirectStoreRecords,
  normalizeInstacartRecords,
} from "../scripts/normalize-instacart-pricing.mjs";
import {
  crossSourceQualifiersCompatible,
  numericProductVariantsCompatible,
  productQualifierEvidence,
} from "../scripts/match-product-qualifiers.mjs";
import {
  packagedProductVariantsCompatible,
  productUrlVariantHints,
} from "../scripts/match-packaged-variants.mjs";
import { isSourceExclusiveProduct } from "../scripts/source-exclusive-products.mjs";

const data = (name: string) => readFile(
  new URL(`../data/${name}`, import.meta.url),
  "utf8",
).then(JSON.parse);

test("generated crosswalks are one-to-one and reproduce their automatic evidence", async () => {
  const [
    instacart,
    instacartWeightDetails,
    aliases,
    wholeFoods,
    wholeFoodsMatches,
    safeway,
    safewayMatches,
    qfc,
    qfcMatches,
  ] = await Promise.all([
    data("capture-checkpoint.json"),
    data("instacart-weight-details.json"),
    data("instacart-aliases.json"),
    data("whole-foods-capture-checkpoint.json"),
    data("whole-foods-matches.json"),
    data("safeway-direct-capture-checkpoint.json"),
    data("safeway-direct-matches.json"),
    data("qfc-direct-capture-checkpoint.json"),
    data("qfc-direct-matches.json"),
  ]);

  assert.equal(Object.hasOwn(aliases, "reviewEvidence"), false);

  const instacartByCanonical = new Map<string, Array<Record<string, unknown>>>();
  for (const record of normalizeInstacartRecords(instacart.records, instacartWeightDetails)) {
    const canonicalId = aliases.aliases[record.id] ?? record.id;
    const records = instacartByCanonical.get(canonicalId) ?? [];
    records.push(record);
    instacartByCanonical.set(canonicalId, records);
  }

  const verify = (
    matches: Array<Record<string, any>>,
    sourceRecords: Array<Record<string, any>>,
    externalKey: "id" | "asin",
    sourceName: "amazon_whole_foods" | "safeway.com" | "qfc.com",
  ) => {
    assert.equal(new Set(matches.map((match) => match.productId)).size, matches.length);
    assert.equal(new Set(matches.map((match) => match[externalKey === "id" ? "directId" : "asin"])).size, matches.length);
    const sourceById = new Map(sourceRecords.map((record) => [record[externalKey], record]));

    for (const match of matches) {
      assert.doesNotMatch(match.matchMethod, /human|manual|override|review/i);
      const sourceId = externalKey === "id" ? match.directId : match.asin;
      const source = sourceById.get(sourceId);
      assert.ok(source, `Missing source record ${sourceId}`);
      const candidates = instacartByCanonical.get(match.productId) ?? [];
      assert.ok(candidates.length, `Missing Instacart group ${match.productId}`);

      if (match.matchMethod === "normalized_loose_produce_name_basis") {
        assert.ok(candidates.some((candidate) => looseProduceMatches(
          candidate,
          { ...source, category: source.category || candidate.category },
        )));
      } else if (match.matchMethod === "normalized_loose_meat_name_claims_basis") {
        assert.equal(source.priceBasis, "per lb");
        assert.ok(candidates.some((candidate) => (
          candidate.priceBasis === "per lb"
          && looseMeatMatches(
            candidate,
            { ...source, category: source.category || candidate.category },
          )
        )));
      } else {
        assert.ok(candidates.some((candidate) => (
          !isSourceExclusiveProduct("instacart", candidate)
          && crossSourceQualifiersCompatible(
            productQualifierEvidence(candidate),
            productQualifierEvidence(source),
          )
          && numericProductVariantsCompatible(candidate.name, source.title)
          && packagedProductVariantsCompatible(
            `${candidate.name} ${candidate.size ?? ""} ${productUrlVariantHints(candidate.productUrl)}`,
            `${source.title} ${source.size ?? ""} ${productUrlVariantHints(source.productUrl)}`,
          )
        )));
        assert.equal(
          isSourceExclusiveProduct(sourceName, source),
          false,
          `Packaged match ${match.productId} uses a ${sourceName} house brand`,
        );
      }
    }
  };

  verify(wholeFoodsMatches.allMatches, wholeFoods.records, "asin", "amazon_whole_foods");
  verify(safewayMatches.matches, normalizeDirectStoreRecords(safeway.records), "id", "safeway.com");
  verify(qfcMatches.matches, normalizeDirectStoreRecords(qfc.records), "id", "qfc.com");

  const targetedWholeFoodsQueries = new Map<string, { asins: string[] }>(
    wholeFoods.queries
      .filter((query: Record<string, unknown>) => query.targetProductId)
      .map((query: Record<string, any>) => [
        String(query.targetProductId),
        { asins: query.asins },
      ]),
  );
  for (const match of wholeFoodsMatches.allMatches) {
    if (match.matchMethod === "targeted_query_brand_name_size") {
      const query = targetedWholeFoodsQueries.get(String(match.productId));
      assert.ok(query, `Missing targeted query for ${match.productId}`);
      assert.equal(
        query.asins[0],
        match.asin,
        `Targeted match ${match.productId} did not use the first priced result`,
      );
    }
  }

  assert.equal(
    wholeFoodsMatches.allMatches.some((match: Record<string, string>) => (
      match.productId === "16292127" && match.asin === "B000REVDOQ"
    )),
    false,
    "Ezekiel 4:9 bread must not match 7 Sprouted Grains bread",
  );
  assert.equal(
    wholeFoodsMatches.allMatches.some((match: Record<string, string>) => (
      match.productId === "23812281" && match.asin !== "B08QM46FGG"
    )),
    false,
    "Mexican Wedding cookies must not match another Siete flavor",
  );
  assert.ok(
    wholeFoodsMatches.allMatches.some((match: Record<string, string>) => (
      match.productId === "23812281" && match.asin === "B08QM46FGG"
    )),
    "Verified Mexican Wedding cookie size evidence should reproduce its exact match",
  );
  for (const [productId, rejectedAsin] of [
    ["24851", "B000SRLN7Y"],
    ["19650750", "B012CIIDBK"],
    ["16290443", "B0GFXLR11T"],
    ["134238", "B084114YHX"],
    ["22327171", "B00NWJE9NK"],
  ]) {
    assert.equal(
      wholeFoodsMatches.allMatches.some((match: Record<string, string>) => (
        match.productId === productId && match.asin === rejectedAsin
      )),
      false,
      `${productId} must not use rejected variant ${rejectedAsin}`,
    );
  }

  for (const [productId, directId] of [
    ["16355028", "960071218"],
    ["40439735", "970784648"],
    ["30845593", "971151053"],
    ["29132", "960076404"],
  ]) {
    assert.ok(
      safewayMatches.matches.some((match: Record<string, string>) => (
        match.productId === productId && match.directId === directId
      )),
      `Safeway match ${productId} should reproduce dotted/FZ size parsing`,
    );
  }
  for (const [productId, rejectedDirectId] of [
    ["190097", "970557754"],
    ["82346", "960143967"],
  ]) {
    assert.equal(
      safewayMatches.matches.some((match: Record<string, string>) => (
        match.productId === productId && match.directId === rejectedDirectId
      )),
      false,
      `${productId} must not use rejected Safeway variant ${rejectedDirectId}`,
    );
  }
  assert.equal(
    qfcMatches.matches.some((match: Record<string, string>) => (
      match.productId === "25601" && match.directId === "0003997802330"
    )),
    false,
    "Gluten-free muesli must not match flaxseed meal",
  );
});

test("published comparisons never mix selling bases", async () => {
  const site = await data("site-data.json");
  for (const product of site.products) {
    const bases = new Set(
      Object.values(product.prices).map((price: any) => price.priceBasis),
    );
    assert.equal(
      bases.size,
      1,
      `${product.id} ${product.name} mixes ${[...bases].join(" and ")}`,
    );
    for (const price of Object.values(product.prices) as any[]) {
      assert.notEqual(
        price.pricingMode,
        "unverified_variable_weight",
        `${product.id} ${product.name} published an unverified weight price`,
      );
    }
  }
});

test("live produce and meat captures produce strict cross-store comparisons", async () => {
  const site = await data("site-data.json");
  const byId = new Map(site.products.map((product: any) => [product.id, product]));

  const navelOrange: any = byId.get("3401790");
  assert.deepEqual(Object.keys(navelOrange.prices).sort(), ["metro", "pcc", "safeway"]);
  assert.equal(navelOrange.prices.pcc.priceBasis, "per lb");
  assert.equal(navelOrange.prices.metro.priceBasis, "per lb");
  assert.equal(navelOrange.prices.pcc.price, 2.99);
  assert.equal(navelOrange.prices.metro.price, 2.09);
  assert.equal(navelOrange.prices.pcc.estimatedItemPrice, 2.34);
  assert.equal(navelOrange.prices.metro.estimatedItemPrice, 1.88);
  assert.equal(navelOrange.prices.safeway.priceBasis, "per lb");
  assert.equal(navelOrange.prices.safeway.price, 2.49);
  assert.equal(navelOrange.prices.safeway.estimatedItemPrice, 1.25);

  const organicBroccoli: any = byId.get("16345572");
  assert.deepEqual(
    Object.keys(organicBroccoli.prices).sort(),
    ["metro", "pcc", "safeway"],
  );
  assert.equal(organicBroccoli.prices.pcc.price, 2.99);
  assert.equal(organicBroccoli.prices.metro.price, 4.79);
  assert.equal(organicBroccoli.prices.safeway.price, 3.79);

  const groundBeef: any = byId.get("297310");
  assert.deepEqual(Object.keys(groundBeef.prices).sort(), ["qfc", "safeway", "traderjoes"]);
  assert.equal(groundBeef.prices.qfc.priceBasis, "per lb");
  assert.equal(groundBeef.prices.safeway.priceBasis, "per lb");
  assert.equal(groundBeef.prices.qfc.price, 8.49);
  assert.equal(groundBeef.prices.safeway.price, 8.49);
  assert.equal(groundBeef.prices.traderjoes.priceBasis, "per lb");
  assert.equal(groundBeef.prices.traderjoes.price, 6.49);

  const celeryRoot: any = byId.get("16383572");
  assert.deepEqual(Object.keys(celeryRoot.prices).sort(), ["metro", "pcc"]);
  assert.equal(celeryRoot.priceBasis, "per lb");
  assert.equal(celeryRoot.prices.pcc.price, 2.99);
  assert.equal(celeryRoot.prices.metro.price, 4.19);
  assert.equal(celeryRoot.prices.pcc.estimatedItemPrice, 5.98);
  assert.equal(celeryRoot.prices.metro.estimatedItemPrice, 0.38);
  assert.equal(celeryRoot.prices.pcc.pricingMode, "final_cost_by_weight");
  assert.equal(celeryRoot.prices.metro.pricingMode, "final_cost_by_weight");
});
