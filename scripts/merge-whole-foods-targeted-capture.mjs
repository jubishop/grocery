import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpointPath = path.join(root, "data/whole-foods-capture-checkpoint.json");
const incomingPath = process.argv[2];

if (!incomingPath) {
  throw new Error("Usage: node scripts/merge-whole-foods-targeted-capture.mjs <capture.json>");
}

const [checkpoint, incoming] = await Promise.all([
  readFile(checkpointPath, "utf8").then(JSON.parse),
  readFile(path.resolve(incomingPath), "utf8").then(JSON.parse),
]);

const queryKey = (query) => query.targetProductId
  ? `target:${query.targetProductId}`
  : `query:${String(query.query ?? "").normalize("NFKC").toLowerCase().trim()}`;

const queries = new Map((checkpoint.queries ?? []).map((query) => [queryKey(query), query]));
for (const query of incoming.queries ?? []) {
  queries.set(queryKey(query), query);
}

const records = new Map((checkpoint.records ?? []).map((record) => [record.asin, record]));
for (const record of incoming.records ?? []) {
  const {
    targetProductId: _targetProductId,
    targetName: _targetName,
    targetSize: _targetSize,
    searchRank: _searchRank,
    ...sourceRecord
  } = record;
  const existing = records.get(record.asin) ?? {};
  const nonEmptySourceRecord = Object.fromEntries(
    Object.entries(sourceRecord).filter(([, value]) => value !== "" && value != null),
  );
  records.set(record.asin, {
    ...existing,
    ...nonEmptySourceRecord,
  });
}

const updatedAt = incoming.capturedAt ?? new Date().toISOString();
const output = {
  ...checkpoint,
  updatedAt,
  records: [...records.values()].sort((left, right) => (
    left.asin.localeCompare(right.asin)
  )),
  queries: [...queries.values()].sort((left, right) => (
    String(left.query).localeCompare(String(right.query))
  )),
};

const temporaryPath = `${checkpointPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, checkpointPath);
console.log(JSON.stringify({
  previousRecords: checkpoint.records.length,
  incomingRecords: incoming.records?.length ?? 0,
  records: output.records.length,
  previousQueries: checkpoint.queries.length,
  incomingQueries: incoming.queries?.length ?? 0,
  queries: output.queries.length,
}, null, 2));
