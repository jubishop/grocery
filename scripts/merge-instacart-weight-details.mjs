import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { instacartPricingKey } from "./normalize-instacart-pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const detailsPath = path.join(root, "data/instacart-weight-details.json");
const incomingPath = process.argv[2];
const storeSlugs = new Map([
  ["metro", "metropolitan-market"],
  ["pcc", "pcc-community-markets"],
  ["qfc", "qfc"],
  ["safeway", "safeway"],
]);

if (!incomingPath) {
  throw new Error("Usage: node scripts/merge-instacart-weight-details.mjs <capture.json>");
}

const [current, incoming] = await Promise.all([
  readFile(detailsPath, "utf8").then(JSON.parse),
  readFile(path.resolve(incomingPath), "utf8").then(JSON.parse),
]);

if (!Array.isArray(current.records) || !Array.isArray(incoming.records)) {
  throw new Error("Both weight-detail files must contain a records array");
}

function validate(record) {
  const key = instacartPricingKey(record);
  const expectedSlug = storeSlugs.get(record.storeId);
  if (!record.id || !expectedSlug || key.startsWith("|") || key.endsWith("|")) {
    throw new Error(`Invalid Instacart weight-detail identity: ${key}`);
  }
  const url = new URL(record.productUrl);
  if (
    url.hostname !== "www.instacart.com"
    || !url.pathname.includes(`/products/${record.id}-`)
    || url.searchParams.get("retailerSlug") !== expectedSlug
  ) {
    throw new Error(`Weight detail ${key} has the wrong product URL`);
  }
  const validFixedPrice = (
    record.pricingMode === "fixed_price"
    && record.priceBasis === "per item"
    && Number.isFinite(Number(record.itemPrice))
    && Number(record.itemPrice) > 0
  );
  const validWeightPrice = (
    record.priceBasis === "per lb"
    && ["final_cost_by_weight", "unit_price_per_lb"].includes(record.pricingMode)
    && Number.isFinite(Number(record.unitPrice))
    && Number(record.unitPrice) > 0
  );
  if (!validFixedPrice && !validWeightPrice) {
    throw new Error(`Weight detail ${key} lacks verified fixed-item or per-pound pricing`);
  }
  return key;
}

const recordsByKey = new Map();
for (const record of current.records) recordsByKey.set(validate(record), record);
const previousKeys = new Set(recordsByKey.keys());
for (const record of incoming.records) {
  const key = validate(record);
  recordsByKey.set(key, {
    ...recordsByKey.get(key),
    ...record,
  });
}

const records = [...recordsByKey.values()].sort((left, right) => (
  left.storeId.localeCompare(right.storeId)
  || String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
));
const output = {
  ...current,
  capturedAt: incoming.capturedAt ?? new Date().toISOString(),
  records,
};
const temporaryPath = `${detailsPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, detailsPath);

console.log(JSON.stringify({
  previousRecords: current.records.length,
  incomingRecords: incoming.records.length,
  newRecords: [...recordsByKey.keys()].filter((key) => !previousKeys.has(key)).length,
  records: records.length,
}, null, 2));
