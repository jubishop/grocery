import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const databasePath = fileURLToPath(new URL("../data/grocery-prices.sqlite", import.meta.url));
const siteDataPath = fileURLToPath(new URL("../data/site-data.json", import.meta.url));

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
    const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));

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
  } finally {
    database.close();
  }
});
