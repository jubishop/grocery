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
