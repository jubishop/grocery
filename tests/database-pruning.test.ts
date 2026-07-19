import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const databasePath = fileURLToPath(new URL("../data/grocery-prices.sqlite", import.meta.url));
const siteDataPath = fileURLToPath(new URL("../data/site-data.json", import.meta.url));
const publicSiteDataPath = fileURLToPath(new URL("../public/site-data.json", import.meta.url));

test("SQLite excludes obsolete Safeway and QFC Instacart prices", () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const forbidden = database.prepare(`
      SELECT COUNT(*) AS count
      FROM price_observations
      WHERE source = 'instacart'
        AND store_id IN ('safeway', 'qfc')
    `).get() as { count: number };
    const observations = database.prepare(`
      SELECT COUNT(*) AS count
      FROM price_observations
    `).get() as { count: number };
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));

    assert.equal(forbidden.count, 0);
    assert.equal(observations.count, siteData.summary.observationCount);
  } finally {
    database.close();
  }
});

test("aggregate Safeway and QFC markup diagnostics remain available", () => {
  const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
  const audits = new Map(
    siteData.pricingResearch.directAudit.map((audit: { storeId: string }) => [audit.storeId, audit]),
  );

  for (const storeId of ["safeway", "qfc"]) {
    const audit = audits.get(storeId) as {
      comparedProducts: number;
      totalInstacart: number;
      totalDirect: number;
      basketPercent: number;
    } | undefined;
    assert.ok(audit, `Missing ${storeId} aggregate markup audit`);
    assert.ok(audit.comparedProducts > 0);
    assert.ok(audit.totalInstacart > audit.totalDirect);
    assert.ok(audit.basketPercent > 0);
  }
});

test("the complete public catalog is reconstructed from host-safe chunks", () => {
  const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
  const manifest = JSON.parse(readFileSync(publicSiteDataPath, "utf8"));

  assert.equal(manifest.products, undefined);
  assert.ok(manifest.productChunks.length > 1);
  const chunks = manifest.productChunks.map((publicPath: string) => {
    const chunkPath = fileURLToPath(new URL(`../public${publicPath}`, import.meta.url));
    assert.ok(statSync(chunkPath).size < 25 * 1024 * 1024);
    return JSON.parse(readFileSync(chunkPath, "utf8"));
  });
  const productIds = chunks.flat().map((product: any) => product.id);

  assert.equal(productIds.length, siteData.products.length);
  assert.equal(new Set(productIds).size, productIds.length);
  assert.deepEqual(productIds, siteData.products.map((product: any) => product.id));
  assert.equal(manifest.summary.searchableCatalogProducts, siteData.products.length);
});

test("retailer house brands stay in raw SQLite without bypassing strict matching", () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const retainedStandalone = database.prepare(`
      SELECT COUNT(*) AS count
      FROM product_identifiers AS identifier
      WHERE (
        source = 'instacart'
        AND (
          source_title LIKE '365 by Whole Foods Market%'
          OR source_title LIKE 'Whole Foods Market%'
          OR source_title LIKE 'PCC %'
          OR source_title LIKE 'Metropolitan Market%'
          OR source_title LIKE 'Signature Select%'
          OR source_title LIKE 'O Organics%'
          OR source_title LIKE 'Open Nature%'
          OR source_title LIKE 'Lucerne%'
          OR source_title LIKE 'Kroger%'
          OR source_title LIKE 'Simple Truth%'
          OR source_title LIKE 'Private Selection%'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM product_matches AS match
          WHERE match.product_id = identifier.product_id
        )
      ) OR (
        source = 'amazon_whole_foods'
        AND product_id LIKE 'wf:%'
        AND (
          source_title LIKE '365 by Whole Foods Market%'
          OR source_title LIKE 'Whole Foods Market%'
        )
      ) OR (
        source = 'safeway.com'
        AND product_id LIKE 'safeway:%'
        AND (
          source_title LIKE 'Signature Select%'
          OR source_title LIKE 'O Organics%'
          OR source_title LIKE 'Open Nature%'
        )
      ) OR (
        source = 'qfc.com'
        AND product_id LIKE 'qfc:%'
        AND (
          source_title LIKE 'Kroger%'
          OR source_title LIKE 'Simple Truth%'
          OR source_title LIKE 'Private Selection%'
        )
      )
    `).get() as { count: number };
    const comparisonLeaks = database.prepare(`
      SELECT COUNT(*) AS count
      FROM product_matches AS match
      JOIN product_identifiers AS identifier
        ON identifier.source = match.source
       AND identifier.external_id = match.external_id
      WHERE match.match_method NOT IN (
        'normalized_loose_meat_name_claims_basis',
        'normalized_loose_produce_name_basis'
      )
      AND ((
        identifier.source = 'amazon_whole_foods'
        AND (
          identifier.source_title LIKE '365 by Whole Foods Market%'
          OR identifier.source_title LIKE 'Whole Foods Market%'
        )
      ) OR (
        identifier.source = 'safeway.com'
        AND (
          identifier.source_title LIKE 'Signature Select%'
          OR identifier.source_title LIKE 'O Organics%'
          OR identifier.source_title LIKE 'Open Nature%'
        )
      ) OR (
        identifier.source = 'qfc.com'
        AND (
          identifier.source_title LIKE 'Kroger%'
          OR identifier.source_title LIKE 'Simple Truth%'
          OR identifier.source_title LIKE 'Private Selection%'
        )
      ))
    `).get() as { count: number };
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));

    assert.ok(retainedStandalone.count > 0);
    assert.equal(comparisonLeaks.count, 0);
    assert.ok(siteData.summary.retainedSourceExclusiveRecords.instacart > 0);
    assert.ok(siteData.summary.retainedSourceExclusiveRecords.wholefoods > 0);
    assert.ok(siteData.summary.retainedSourceExclusiveRecords.safeway > 0);
    assert.ok(siteData.summary.retainedSourceExclusiveRecords.qfc > 0);
  } finally {
    database.close();
  }
});

test("weighted estimates retain provenance but only verified unit rates are comparable", () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const celery = database.prepare(`
      SELECT store_id, price_cents, price_basis, pricing_mode,
             estimated_item_price_cents, estimated_weight_lb, comparison_eligible
      FROM price_observations
      WHERE source = 'instacart'
        AND external_id = '16383572'
      ORDER BY store_id
    `).all() as Array<Record<string, any>>;
    const celeryProduct = database.prepare(`
      SELECT price_basis
      FROM products
      WHERE id = '16383572'
    `).get() as { price_basis: string };
    const excluded = database.prepare(`
      SELECT COUNT(*) AS count
      FROM price_observations
      WHERE comparison_eligible = 0
        AND exclusion_reason = 'unverified_variable_weight_price'
    `).get() as { count: number };
    const retainedCurrentProducts = database.prepare(`
      SELECT COUNT(DISTINCT product_id) AS count
      FROM price_observations
      WHERE available = 1
    `).get() as { count: number };
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
    const catalogOnly = siteData.products.find((product: any) => product.id === "105962797");

    assert.deepEqual(celery.map((row) => ({ ...row })), [
      {
        store_id: "metro",
        price_cents: 419,
        price_basis: "per lb",
        pricing_mode: "final_cost_by_weight",
        estimated_item_price_cents: 38,
        estimated_weight_lb: 0.09,
        comparison_eligible: 1,
      },
      {
        store_id: "pcc",
        price_cents: 299,
        price_basis: "per lb",
        pricing_mode: "final_cost_by_weight",
        estimated_item_price_cents: 598,
        estimated_weight_lb: 2,
        comparison_eligible: 1,
      },
    ]);
    assert.equal(celeryProduct.price_basis, "per lb");
    assert.equal(excluded.count, siteData.summary.excludedUnverifiedWeightObservations);
    assert.ok(excluded.count > 0);
    assert.equal(siteData.products.length, retainedCurrentProducts.count);
    assert.ok(catalogOnly);
    assert.equal(catalogOnly.comparableStoreCount, 0);
    assert.equal(catalogOnly.prices.metro.comparisonEligible, false);
    assert.equal(catalogOnly.prices.metro.exclusionReason, "unverified_variable_weight_price");
  } finally {
    database.close();
  }
});

test("Trader Joe's is published as a searchable commodity overlay", () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const observations = database.prepare(`
      SELECT COUNT(*) AS count
      FROM price_observations
      WHERE source = 'traderjoes.com'
        AND store_id = 'traderjoes'
    `).get() as { count: number };
    const matches = database.prepare(`
      SELECT COUNT(*) AS count
      FROM product_matches
      WHERE source = 'traderjoes.com'
    `).get() as { count: number };
    const forbiddenPaths = database.prepare(`
      SELECT COUNT(*) AS count
      FROM product_matches
      WHERE LOWER(match_method) LIKE '%human%'
         OR LOWER(match_method) LIKE '%manual%'
         OR LOWER(match_method) LIKE '%review%'
         OR LOWER(match_method) LIKE '%override%'
    `).get() as { count: number };
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
    const traderJoes = siteData.stores.find((store: { id: string }) => store.id === "traderjoes");
    const traderProducts = siteData.products.filter((product: any) => product.prices.traderjoes);
    const traderComparableProducts = traderProducts.filter((product: any) => (
      product.comparableStoreCount >= 2
      && product.prices.traderjoes.comparisonEligible
    ));
    const coreStoreIds = ["pcc", "metro", "safeway", "qfc", "wholefoods"];
    const coreAllStoreProducts = siteData.products.filter((product: any) => (
      coreStoreIds.every((storeId) => product.prices[storeId]?.comparisonEligible)
    )).length;
    const butter = traderProducts.find((product: any) => (
      product.searchAliases.includes("Butter Quarters, Salted")
    ));

    assert.equal(traderJoes.coverageMode, "commodity-overlay");
    assert.equal(siteData.summary.coreStoreCount, 5);
    assert.equal(siteData.summary.coreAllStoreProducts, coreAllStoreProducts);
    assert.ok(coreAllStoreProducts > 0);
    assert.equal(observations.count, siteData.summary.traderJoesCatalogProducts);
    assert.ok(siteData.summary.traderJoesCatalogProducts > siteData.summary.traderJoesEligibleProducts);
    assert.equal(matches.count, siteData.summary.acceptedTraderJoesMatches);
    assert.equal(traderProducts.length, siteData.summary.traderJoesCatalogProducts);
    assert.equal(traderComparableProducts.length, siteData.summary.traderJoesComparableProducts);
    assert.ok(butter);
    assert.equal(butter.prices.traderjoes.sourceTitle, "Butter Quarters, Salted");
    assert.equal(forbiddenPaths.count, 0);
  } finally {
    database.close();
  }
});
