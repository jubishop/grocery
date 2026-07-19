import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpointPath = path.join(root, "data/capture-checkpoint.json");
const incomingPath = process.argv[2];
const supportedStores = new Set(["pcc", "metro", "safeway", "qfc"]);

if (!incomingPath) {
  throw new Error("Usage: node scripts/merge-instacart-capture.mjs <capture.json>");
}

const [checkpoint, incoming] = await Promise.all([
  readFile(checkpointPath, "utf8").then(JSON.parse),
  readFile(path.resolve(incomingPath), "utf8").then(JSON.parse),
]);

if (incoming.source && incoming.source !== "instacart.com") {
  throw new Error("Incoming capture is not from Instacart.com");
}

const normalizedKey = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .trim()
  .replace(/\s+/g, " ");

const queryKey = (query) => [
  normalizedKey(query.storeId),
  normalizedKey(query.query),
].join(":");

const queries = new Map(
  (checkpoint.queries ?? []).map((query) => [queryKey(query), query]),
);
for (const query of incoming.queries ?? []) {
  if (!supportedStores.has(query.storeId)) {
    throw new Error(`Unsupported Instacart store ${query.storeId}`);
  }
  queries.set(queryKey(query), query);
}

const recordKey = (record) => `${record.storeId}:${record.id}`;
const records = new Map(
  (checkpoint.records ?? []).map((record) => [recordKey(record), record]),
);
for (const incomingRecord of incoming.records ?? []) {
  if (!incomingRecord.id) throw new Error("Incoming Instacart record is missing an id");
  if (!supportedStores.has(incomingRecord.storeId)) {
    throw new Error(`Unsupported Instacart store ${incomingRecord.storeId}`);
  }
  const key = recordKey(incomingRecord);
  const existing = records.get(key) ?? {};
  const nonEmptyIncoming = Object.fromEntries(
    Object.entries(incomingRecord).filter(([, value]) => value !== "" && value != null),
  );
  records.set(key, {
    ...existing,
    ...nonEmptyIncoming,
    id: String(incomingRecord.id),
  });
}

const output = {
  ...checkpoint,
  updatedAt: incoming.capturedAt ?? new Date().toISOString(),
  records: [...records.values()].sort((left, right) => (
    left.storeId.localeCompare(right.storeId)
    || String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
  )),
  queries: [...queries.values()].sort((left, right) => (
    left.storeId.localeCompare(right.storeId)
    || String(left.query).localeCompare(String(right.query), undefined, { numeric: true })
  )),
};

const temporaryPath = `${checkpointPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, checkpointPath);

console.log(JSON.stringify({
  previousRecords: checkpoint.records?.length ?? 0,
  incomingRecords: incoming.records?.length ?? 0,
  records: output.records.length,
  previousQueries: checkpoint.queries?.length ?? 0,
  incomingQueries: incoming.queries?.length ?? 0,
  queries: output.queries.length,
}, null, 2));
