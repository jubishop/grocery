import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { looseMeatKey } from "./match-loose-meat.mjs";
import { isDirectVariableWeightRecord } from "./normalize-instacart-pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedStores = new Map([
  ["safeway", "safeway.com"],
  ["qfc", "qfc.com"],
]);
const storeId = String(process.argv[2] ?? "").toLowerCase();
const incomingPath = process.argv[3];
const expectedSource = supportedStores.get(storeId);

if (!expectedSource || !incomingPath) {
  throw new Error(
    "Usage: node scripts/merge-direct-targeted-capture.mjs <safeway|qfc> <capture.json>",
  );
}

const checkpointPath = path.join(root, `data/${storeId}-direct-capture-checkpoint.json`);
const [checkpoint, incoming] = await Promise.all([
  readFile(checkpointPath, "utf8").then(JSON.parse),
  readFile(path.resolve(incomingPath), "utf8").then(JSON.parse),
]);

if (checkpoint.source !== expectedSource || checkpoint.store?.id !== storeId) {
  throw new Error(`Unexpected ${storeId} checkpoint identity`);
}
if (incoming.source !== expectedSource || incoming.storeId !== storeId) {
  throw new Error(`Incoming capture is not from ${expectedSource}`);
}

function normalizedKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function queryKey(query) {
  const captureKey = normalizedKey(query.capturedAt);
  if (query.targetProductId) return `target:${query.targetProductId}:${captureKey}`;
  return [
    "query",
    normalizedKey(query.category),
    normalizedKey(query.query),
    captureKey,
  ].join(":");
}

const queries = [...(checkpoint.queries ?? [])];
const queryIndex = new Map(queries.map((query, index) => [queryKey(query), index]));
for (const query of incoming.queries ?? []) {
  if (query.storeId && query.storeId !== storeId) {
    throw new Error(`Query ${query.query} belongs to ${query.storeId}, not ${storeId}`);
  }
  const normalizedQuery = {
    ...query,
    storeId,
  };
  const key = queryKey(normalizedQuery);
  const existingIndex = queryIndex.get(key);
  if (existingIndex == null) {
    queryIndex.set(key, queries.length);
    queries.push(normalizedQuery);
  } else {
    queries[existingIndex] = normalizedQuery;
  }
}

const records = [...(checkpoint.records ?? [])];
const recordIndex = new Map(records.map((record, index) => [String(record.id), index]));
const isCommodityCategory = (category) => (
  /^(?:produce|meat\s*(?:&|and)\s*seafood)$/i.test(String(category ?? "").trim())
);
for (const incomingRecord of incoming.records ?? []) {
  if (!incomingRecord.id) throw new Error("Incoming direct-store record is missing an id");
  if (incomingRecord.storeId && incomingRecord.storeId !== storeId) {
    throw new Error(`Record ${incomingRecord.id} belongs to ${incomingRecord.storeId}, not ${storeId}`);
  }
  if (incomingRecord.source && incomingRecord.source !== expectedSource) {
    throw new Error(`Record ${incomingRecord.id} is not from ${expectedSource}`);
  }
  const {
    targetProductId: _targetProductId,
    targetName: _targetName,
    targetSize: _targetSize,
    searchRank: _searchRank,
    ...sourceRecord
  } = incomingRecord;
  const id = String(sourceRecord.id);
  const existingIndex = recordIndex.get(id);
  const existingRecord = existingIndex == null ? null : records[existingIndex];
  const normalizedRecord = {
    ...(existingRecord ?? {}),
    ...sourceRecord,
    storeId,
    source: expectedSource,
  };
  if (
    existingRecord
    && isCommodityCategory(existingRecord.category)
    && !isCommodityCategory(sourceRecord.category)
  ) {
    // Targeted searches can return unrelated products. Do not let a later
    // sauce or snack query erase a previously captured produce/meat category.
    normalizedRecord.category = existingRecord.category;
  }
  if (looseMeatKey({ ...normalizedRecord, category: "Meat & Seafood" })) {
    // A new unrelated search can be the first time a raw per-pound cut appears.
    // Its title, basis, and protected preparation guard are stronger category
    // evidence than the category of the query that happened to return it.
    normalizedRecord.category = "Meat & Seafood";
  }
  if (existingIndex == null) {
    recordIndex.set(id, records.length);
    records.push(normalizedRecord);
  } else {
    records[existingIndex] = normalizedRecord;
  }
}

const normalizedRecords = records.map((record) => {
  const scopedRecord = {
    ...record,
    storeId,
    source: expectedSource,
  };
  if (storeId === "qfc" && /\/\s*lb\b/i.test(String(scopedRecord.unitText ?? ""))) {
    const poundRateCandidate = {
      ...scopedRecord,
      priceBasis: "per lb",
    };
    return {
      ...scopedRecord,
      priceBasis: isDirectVariableWeightRecord(poundRateCandidate)
        ? "per lb"
        : "per item",
    };
  }
  if (
    storeId === "qfc"
    && String(scopedRecord.priceBasis ?? "").toLowerCase() === "per lb"
    && !isDirectVariableWeightRecord(scopedRecord)
  ) {
    return {
      ...scopedRecord,
      priceBasis: "per item",
    };
  }
  return scopedRecord;
});

const output = {
  ...checkpoint,
  capturedAt: incoming.capturedAt ?? checkpoint.capturedAt,
  records: normalizedRecords,
  queries,
};
const temporaryPath = `${checkpointPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, checkpointPath);

console.log(JSON.stringify({
  storeId,
  previousRecords: checkpoint.records?.length ?? 0,
  incomingRecords: incoming.records?.length ?? 0,
  records: output.records.length,
  previousQueries: checkpoint.queries?.length ?? 0,
  incomingQueries: incoming.queries?.length ?? 0,
  queries: output.queries.length,
}, null, 2));
