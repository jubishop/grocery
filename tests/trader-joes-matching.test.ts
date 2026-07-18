import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeInstacartRecords,
} from "../scripts/normalize-instacart-pricing.mjs";
import {
  packageQuantity,
  traderJoesCommodityFamily,
  traderJoesCommodityMatch,
} from "../scripts/match-trader-joes-commodities.mjs";

const data = (name: string) => readFile(
  new URL(`../data/${name}`, import.meta.url),
  "utf8",
).then(JSON.parse);

test("Trader Joe's capture is broad but publication is a strict automatic commodity subset", async () => {
  const [capture, matches] = await Promise.all([
    data("trader-joes-capture-checkpoint.json"),
    data("trader-joes-matches.json"),
  ]);

  assert.ok(capture.records.length >= 350);
  assert.ok(matches.counts.commodityEligible >= 100);
  assert.ok(matches.counts.excludedExclusiveOrPrepared >= 150);
  assert.equal(matches.matches.length, matches.counts.accepted);
  assert.equal(new Set(matches.matches.map((match: any) => match.traderJoesId)).size, matches.matches.length);
  assert.equal(new Set(matches.matches.map((match: any) => match.productId)).size, matches.matches.length);
  assert.doesNotMatch(matches.methodology, /human|manual|override|review/i);

  const capturedById = new Map<string, any>(capture.records.map((record: any) => [record.id, record]));
  for (const match of matches.matches) {
    assert.ok(capturedById.has(match.traderJoesId));
    assert.ok(matches.eligibleIds.includes(match.traderJoesId));
    assert.doesNotMatch(match.matchMethod, /human|manual|override|review/i);
  }

  for (const forbiddenTitle of [
    "Garlic Parsley Potato Kit",
    "Black Bean & Cheese Taquitos",
    "Cheddar Macaroni & Cheese",
    "Sesame Teriyaki Beef Skirt Steak",
  ]) {
    const record: any = capture.records.find((candidate: any) => candidate.title === forbiddenTitle);
    assert.ok(record, `Missing captured regression fixture ${forbiddenTitle}`);
    assert.equal(traderJoesCommodityFamily(record), null);
    assert.equal(matches.eligibleIds.includes(record.id), false);
  }
});

test("every accepted Trader Joe's match reproduces from captured records", async () => {
  const [capture, matches, instacart, weightDetails, aliases] = await Promise.all([
    data("trader-joes-capture-checkpoint.json"),
    data("trader-joes-matches.json"),
    data("capture-checkpoint.json"),
    data("instacart-weight-details.json"),
    data("instacart-aliases.json"),
  ]);
  const capturedById = new Map<string, any>(capture.records.map((record: any) => [record.id, record]));
  const canonicalRecords = new Map<string, any[]>();
  for (const record of normalizeInstacartRecords(instacart.records, weightDetails)) {
    const productId = aliases.aliases[record.id] ?? record.id;
    const records = canonicalRecords.get(productId) ?? [];
    records.push(record);
    canonicalRecords.set(productId, records);
  }

  for (const match of matches.matches) {
    const source = capturedById.get(match.traderJoesId);
    const candidates = canonicalRecords.get(match.productId) ?? [];
    assert.ok(
      candidates.some((candidate) => traderJoesCommodityMatch(source, candidate).matched),
      `${match.traderJoesTitle} no longer reproduces against ${match.canonicalName}`,
    );
  }
});

test("Trader Joe's commodity matching rejects qualifier, preparation, and pack mismatches", () => {
  assert.deepEqual(packageQuantity("Black Beans 4 x 15.25 oz"), {
    dimension: "mass",
    amount: 61,
  });

  assert.equal(traderJoesCommodityMatch(
    { title: "Organic Strawberries", size: "16 Oz", category: "Fresh Fruits & Veggies", priceBasis: "per item" },
    { name: "Strawberries", size: "16 oz", category: "Produce", priceBasis: "per item" },
  ).matched, false);

  assert.equal(traderJoesCommodityMatch(
    { title: "Ground Beef 80% lean /20% fat", size: "1 Lb", category: "Beef, Pork & Lamb", priceBasis: "per lb" },
    { name: "Organic Ground Beef 85% Lean", size: "", category: "Meat & Seafood", priceBasis: "per lb" },
  ).matched, false);

  assert.equal(traderJoesCommodityMatch(
    { title: "Black Beans", size: "15.5 Oz", category: "Packaged Fish, Meat, Fruit & Veg", priceBasis: "per item" },
    { name: "Kroger Black Beans 4 x 15.25 oz", size: "4 x 15.25 oz", category: "Canned & Soup", priceBasis: "per item" },
  ).matched, false);

  assert.equal(traderJoesCommodityMatch(
    {
      title: "Organic Free Range Boneless Skinless Chicken Breasts",
      size: "1 Lb",
      category: "Chicken & Turkey",
      priceBasis: "per lb",
      qualifierText: "organic free range boneless skinless chicken breast with rib meat vegetarian diet never given antibiotics",
    },
    {
      name: "Coastal Range Organics Organic Boneless Skinless Chicken Breast",
      size: "",
      category: "Meat & Seafood",
      priceBasis: "per lb",
      qualifierText: "Non-GMO, no antibiotics ever, organic vegetarian fed, free range, no water added",
    },
  ).matched, false);
});
