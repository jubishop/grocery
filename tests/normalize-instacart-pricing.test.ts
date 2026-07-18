import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createInstacartWeightDetailIndex,
  isUnverifiedVariableWeightRecord,
  normalizeDirectStoreRecord,
  normalizeInstacartRecord,
  parseCapturedUnitText,
  parseInstacartProductDetailText,
  pricePerPound,
} from "../scripts/normalize-instacart-pricing.mjs";

test("product detail parser prefers the unit rate over an estimated each total", () => {
  const parsed = parseInstacartProductDetailText(`
    Organic Celery Root (Knob)
    About 2.0 lb each
    • $2.99 / lb
    Final cost by weight
    Current price: $5.98 each (est.)
  `);

  assert.deepEqual(parsed, {
    pricingMode: "final_cost_by_weight",
    priceBasis: "per lb",
    unitPrice: 2.99,
    sourceUnitPrice: 2.99,
    sourceUnit: "lb",
    estimatedItemPrice: 5.98,
    estimatedWeightLb: 2,
    comparisonEligible: true,
    exclusionReason: "",
  });
});

test("direct per-pound current prices normalize without an estimated total", () => {
  const parsed = parseInstacartProductDetailText(`
    Organic Asparagus
    Current price: $7.99 /lb
  `);

  assert.equal(parsed.pricingMode, "unit_price_per_lb");
  assert.equal(parsed.unitPrice, 7.99);
  assert.equal(parsed.priceBasis, "per lb");
  assert.equal(parsed.estimatedItemPrice, null);
});

test("weight units canonicalize to dollars per pound", () => {
  assert.equal(pricePerPound(0.5, "oz"), 8);
  assert.equal(pricePerPound(11.02, "kg"), 5);
  assert.equal(pricePerPound(0.01102, "g"), 5);
});

test("direct-store unit text exposes a comparable weight rate", () => {
  assert.deepEqual(parseCapturedUnitText("$4.93 each ($3.79 / Lb)"), {
    unitPrice: 3.79,
    sourceUnitPrice: 3.79,
    sourceUnit: "lb",
    estimatedItemPrice: 4.93,
  });
  const broccoli = normalizeDirectStoreRecord({
    title: "Organic Broccoli",
    category: "Produce",
    size: "",
    price: 4.93,
    originalPrice: null,
    priceBasis: "per item",
    unitText: "$4.93 each ($3.79 / Lb)",
  });
  assert.equal(broccoli.price, 3.79);
  assert.equal(broccoli.priceBasis, "per lb");
  assert.equal(broccoli.estimatedItemPrice, 4.93);
  assert.equal(broccoli.pricingMode, "final_cost_by_weight");
});

test("fixed packages keep their each price despite informational unit text", () => {
  const oranges = normalizeDirectStoreRecord({
    title: "Navel Oranges Prepacked Bag - 4 Lb",
    category: "Produce",
    size: "4 lb",
    price: 6.99,
    priceBasis: "per item",
    unitText: "$6.99 each ($1.75 / Lb)",
  });
  assert.equal(oranges.price, 6.99);
  assert.equal(oranges.priceBasis, "per item");
  assert.equal(oranges.pricingMode, "fixed_price");
});

test("final-cost records without a captured unit rate are not comparable", () => {
  const parsed = parseInstacartProductDetailText(`
    About 1.5 lb each
    Final cost by weight
    Current price: $4.49 each (est.)
  `);

  assert.equal(parsed.comparisonEligible, false);
  assert.equal(parsed.exclusionReason, "missing_weight_unit_price");
  assert.equal(parsed.unitPrice, null);
});

test("legacy empty-size loose produce is quarantined but packaged goods are not", () => {
  assert.equal(isUnverifiedVariableWeightRecord({
    category: "Produce",
    size: "",
    priceBasis: "per item",
    productUrl: "https://www.instacart.com/products/16383572-organic-celery-root-knob-each?retailerSlug=pcc-community-markets",
  }), true);
  assert.equal(isUnverifiedVariableWeightRecord({
    category: "Produce",
    size: "5 oz",
    priceBasis: "per item",
    productUrl: "https://www.instacart.com/products/74504-organicgirl-salad-5-oz",
  }), false);
  assert.equal(isUnverifiedVariableWeightRecord({
    category: "Baking Essentials",
    size: "5 lb",
    priceBasis: "per item",
    productUrl: "https://www.instacart.com/products/1119196-bread-flour-5-lb",
  }), false);
  assert.equal(isUnverifiedVariableWeightRecord({
    category: "Meat & Seafood",
    size: "",
    priceBasis: "per item",
    productUrl: "https://www.instacart.com/products/105969480-whole-chicken-1-each",
  }), true);
  assert.equal(isUnverifiedVariableWeightRecord({
    category: "Breakfast Foods",
    size: "",
    priceBasis: "per item",
    productUrl: "https://www.instacart.com/products/21690060-organic-quick-rolled-oats-per-lb",
  }), true);
});

test("verified detail replaces only the comparison price and retains provenance", () => {
  const record = {
    id: "16383572",
    storeId: "pcc",
    price: 5.98,
    originalPrice: null,
    priceBasis: "per item",
    capturedAt: "2026-07-17T07:44:20.687Z",
    capturedUrl: "https://www.instacart.com/store/pcc-community-markets/collections/produce",
    productUrl: "https://www.instacart.com/products/16383572-organic-celery-root-knob-each?retailerSlug=pcc-community-markets",
  };
  const detail = {
    ...record,
    pricingMode: "final_cost_by_weight",
    priceBasis: "per lb",
    unitPrice: 2.99,
    sourceUnitPrice: 2.99,
    sourceUnit: "lb",
    estimatedItemPrice: 5.98,
    estimatedWeightLb: 2,
    capturedAt: "2026-07-18T19:10:49.000Z",
  };
  const normalized = normalizeInstacartRecord(record, detail);

  assert.equal(normalized.price, 2.99);
  assert.equal(normalized.priceBasis, "per lb");
  assert.equal(normalized.rawCapturedPrice, 5.98);
  assert.equal(normalized.estimatedItemPrice, 5.98);
  assert.equal(normalized.estimatedWeightLb, 2);
  assert.equal(normalized.comparisonEligible, true);
  assert.equal(normalized.capturedAt, "2026-07-18T19:10:49.000Z");
});

test("captured weight detail keys are unique and valid", async () => {
  const details = JSON.parse(await readFile(
    new URL("../data/instacart-weight-details.json", import.meta.url),
    "utf8",
  ));
  const index = createInstacartWeightDetailIndex(details);

  assert.equal(index.size, 14);
  assert.equal(index.get("pcc|16383572")?.unitPrice, 2.99);
  assert.equal(index.get("metro|16383572")?.unitPrice, 4.19);
  assert.equal(index.get("pcc|3401790")?.unitPrice, 2.99);
  assert.equal(index.get("metro|3401790")?.unitPrice, 2.09);
  assert.equal(index.get("pcc|16345572")?.unitPrice, 2.99);
  assert.equal(index.get("metro|16345572")?.unitPrice, 4.79);
});
