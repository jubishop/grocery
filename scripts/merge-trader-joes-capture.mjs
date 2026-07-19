import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpointPath = path.join(root, "data/trader-joes-capture-checkpoint.json");
const incomingPath = process.argv[2];

if (!incomingPath) {
  throw new Error("Usage: node scripts/merge-trader-joes-capture.mjs <capture.json>");
}

const [checkpoint, incoming] = await Promise.all([
  readFile(checkpointPath, "utf8").then(JSON.parse),
  readFile(path.resolve(incomingPath), "utf8").then(JSON.parse),
]);

if (checkpoint.store?.id !== "traderjoes") {
  throw new Error("Unexpected Trader Joe's checkpoint identity");
}
if (incoming.source && incoming.source !== "traderjoes.com") {
  throw new Error("Incoming capture is not from TraderJoes.com");
}
if (incoming.store?.id && incoming.store.id !== "traderjoes") {
  throw new Error("Incoming capture is not for Trader Joe's");
}

const normalizedKey = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .trim()
  .replace(/\s+/g, " ");

const queries = new Map(
  (checkpoint.queries ?? []).map((query) => [normalizedKey(query.query), query]),
);
for (const query of incoming.queries ?? []) {
  queries.set(normalizedKey(query.query), {
    ...query,
    storeId: "traderjoes",
  });
}

const records = new Map(
  (checkpoint.records ?? []).map((record) => [String(record.id).padStart(6, "0"), record]),
);
for (const incomingRecord of incoming.records ?? []) {
  if (!incomingRecord.id) throw new Error("Incoming Trader Joe's record is missing an id");
  const id = String(incomingRecord.id).padStart(6, "0");
  const existing = records.get(id) ?? {};
  const nonEmptyIncoming = Object.fromEntries(
    Object.entries(incomingRecord).filter(([, value]) => value !== "" && value != null),
  );
  const merged = {
    ...existing,
    ...nonEmptyIncoming,
    id,
    storeId: "traderjoes",
    source: "traderjoes.com",
  };
  if (
    existing.priceBasis === "per lb"
    && incomingRecord.priceBasis === "per item"
  ) {
    // The all-products card uses text such as "/1 Lb" for both fixed packages
    // and variable-weight meat. A prior category/detail capture with an
    // explicit per-pound basis is stronger evidence and must not be downgraded
    // by the less-specific broad catalog card.
    merged.priceBasis = "per lb";
    merged.pricingMode = existing.pricingMode || "unit_price_per_lb";
  }
  records.set(id, merged);
}

const output = {
  ...checkpoint,
  capturedAt: incoming.capturedAt ?? checkpoint.capturedAt,
  methodology: "Every priced product card across every page of TraderJoes.com's all-products catalog was captured with Seattle store 157 selected. The website explicitly does not represent every physical-store product. All valid website inventory, including private-label, prepared, seasonal, and single-store products, is retained in SQLite; strict automatic commodity eligibility and cross-store matching are applied separately.",
  queries: [...queries.values()].sort((left, right) => (
    String(left.query).localeCompare(String(right.query), undefined, { numeric: true })
  )),
  records: [...records.values()].sort((left, right) => (
    String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
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
