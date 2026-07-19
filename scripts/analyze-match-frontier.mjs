import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeInstacartRecords } from "./normalize-instacart-pricing.mjs";
import { isSourceExclusiveProduct } from "./source-exclusive-products.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => path.join(root, "data", name);
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Math.max(1, Number(limitArgument?.split("=")[1] ?? 40));

const [
  instacart,
  weightDetails,
  aliases,
  wholeFoodsCapture,
  wholeFoodsMatches,
  safewayCapture,
  safewayMatches,
  qfcCapture,
  qfcMatches,
  traderJoesCapture,
  traderJoesMatches,
] = await Promise.all([
  readFile(dataPath("capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("instacart-weight-details.json"), "utf8").then(JSON.parse),
  readFile(dataPath("instacart-aliases.json"), "utf8").then(JSON.parse),
  readFile(dataPath("whole-foods-capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("whole-foods-matches.json"), "utf8").then(JSON.parse),
  readFile(dataPath("safeway-direct-capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("safeway-direct-matches.json"), "utf8").then(JSON.parse),
  readFile(dataPath("qfc-direct-capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("qfc-direct-matches.json"), "utf8").then(JSON.parse),
  readFile(dataPath("trader-joes-capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("trader-joes-matches.json"), "utf8").then(JSON.parse),
]);

const storeIds = ["pcc", "metro", "safeway", "qfc"];
const records = normalizeInstacartRecords(instacart.records, weightDetails);
const groups = new Map();
for (const record of records) {
  const productId = aliases.aliases[record.id] ?? record.id;
  const group = groups.get(productId) ?? {
    productId,
    sourceProductIds: new Set(),
    records: [],
    eligibleStoreIds: new Set(),
  };
  group.records.push(record);
  group.sourceProductIds.add(record.id);
  if (record.comparisonEligible !== false) group.eligibleStoreIds.add(record.storeId);
  groups.set(productId, group);
}

function representative(group) {
  const eligible = group.records.filter((record) => record.comparisonEligible !== false);
  return (eligible.length ? eligible : group.records)
    .toSorted((left, right) => (
      String(right.name ?? "").length - String(left.name ?? "").length
      || String(left.id).localeCompare(String(right.id), undefined, { numeric: true })
    ))[0];
}

const groupItems = [...groups.values()].map((group) => {
  const record = representative(group);
  return {
    productId: group.productId,
    sourceProductIds: [...group.sourceProductIds],
    name: record?.name ?? "",
    size: record?.size ?? "",
    category: record?.category ?? "Other Groceries",
    storeIds: [...group.eligibleStoreIds].sort(),
    storeCount: group.eligibleStoreIds.size,
    productUrl: record?.productUrl ?? "",
    comparisonEligible: group.records.some((item) => item.comparisonEligible !== false),
  };
});

const matchedProductIds = {
  wholeFoods: new Set((wholeFoodsMatches.allMatches ?? wholeFoodsMatches.matches).map((match) => match.productId)),
  safeway: new Set(safewayMatches.matches.map((match) => match.productId)),
  qfc: new Set(qfcMatches.matches.map((match) => match.productId)),
  traderJoes: new Set(traderJoesMatches.matches.map((match) => match.productId)),
};

function queryHistory(queries) {
  const targeted = new Map();
  const normalized = new Map();
  const key = (value) => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  for (const query of queries) {
    if (query.targetProductId) {
      const productId = String(query.targetProductId);
      const prior = targeted.get(productId);
      if (!prior || String(query.capturedAt) > String(prior.capturedAt)) targeted.set(productId, query);
    }
    const queryKey = key(query.query);
    const prior = normalized.get(queryKey);
    if (!prior || String(query.capturedAt) > String(prior.capturedAt)) normalized.set(queryKey, query);
  }
  return { targeted, normalized, key };
}

const histories = {
  wholeFoods: queryHistory(wholeFoodsCapture.queries),
  safeway: queryHistory(safewayCapture.queries),
  qfc: queryHistory(qfcCapture.queries),
};

function sourceTargets(source, matchedIds) {
  const history = histories[source];
  return groupItems
    .filter((item) => (
      item.comparisonEligible
      && item.storeCount > 0
      && item.name
      && item.size
      && !matchedIds.has(item.productId)
      && !isSourceExclusiveProduct("instacart", item)
    ))
    .map((item) => {
      const query = `${item.name} ${item.size}`.trim();
      const prior = history.targeted.get(String(item.productId))
        ?? history.normalized.get(history.key(query));
      return {
        ...item,
        query,
        previouslyTargeted: Boolean(prior),
        lastAttemptedAt: prior?.capturedAt ?? null,
        priorResultCount: prior?.count ?? null,
        priority: (
          item.storeCount * 100
          + (prior ? 0 : 25)
          + (/\b(?:produce|meat|seafood|dairy|eggs)\b/i.test(item.category) ? 5 : 0)
        ),
      };
    })
    .sort((left, right) => (
      right.priority - left.priority
      || String(left.lastAttemptedAt ?? "").localeCompare(String(right.lastAttemptedAt ?? ""))
      || left.name.localeCompare(right.name)
    ))
    .slice(0, limit);
}

const instacartMissingStore = groupItems
  .filter((item) => (
    item.comparisonEligible
    && item.storeCount === 3
    && !isSourceExclusiveProduct("instacart", item)
  ))
  .map((item) => ({
    ...item,
    missingStoreId: storeIds.find((storeId) => !item.storeIds.includes(storeId)),
    query: `${item.name} ${item.size}`.trim(),
  }))
  .sort((left, right) => left.missingStoreId.localeCompare(right.missingStoreId) || left.name.localeCompare(right.name))
  .slice(0, limit);

const unresolved = records
  .filter((record) => record.comparisonEligible === false)
  .map((record) => ({
    storeId: record.storeId,
    productId: record.id,
    name: record.name,
    size: record.size ?? "",
    price: record.price,
    productUrl: record.productUrl,
    exclusionReason: record.exclusionReason,
  }));

const traderJoesMatchedIds = new Set(traderJoesMatches.matches.map((match) => match.traderJoesId));
const traderJoesEligibleIds = new Set(traderJoesMatches.eligibleIds);
const traderJoesUnmatched = traderJoesCapture.records
  .filter((record) => traderJoesEligibleIds.has(record.id) && !traderJoesMatchedIds.has(record.id))
  .map((record) => ({
    id: record.id,
    name: record.name ?? record.title,
    size: record.size,
    price: record.price,
    category: record.category,
    productUrl: record.productUrl,
  }))
  .sort((left, right) => String(left.name).localeCompare(String(right.name)))
  .slice(0, limit);

const output = {
  generatedAt: new Date().toISOString(),
  limit,
  counts: {
    instacartRecords: records.length,
    canonicalProducts: groupItems.length,
    canonicalByEligibleStoreCount: Object.fromEntries(
      [0, 1, 2, 3, 4].map((count) => [
        count,
        groupItems.filter((item) => item.storeCount === count).length,
      ]),
    ),
    captured: {
      wholeFoods: wholeFoodsCapture.records.length,
      safewayDirect: safewayCapture.records.length,
      qfcDirect: qfcCapture.records.length,
      traderJoes: traderJoesCapture.records.length,
    },
    matched: {
      wholeFoods: matchedProductIds.wholeFoods.size,
      safewayDirect: matchedProductIds.safeway.size,
      qfcDirect: matchedProductIds.qfc.size,
      traderJoes: traderJoesMatches.matches.length,
    },
    unresolvedByReason: Object.fromEntries(
      [...new Set(unresolved.map((record) => record.exclusionReason))]
        .sort()
        .map((reason) => [reason, unresolved.filter((record) => record.exclusionReason === reason).length]),
    ),
  },
  targets: {
    wholeFoods: sourceTargets("wholeFoods", matchedProductIds.wholeFoods),
    safewayDirect: sourceTargets("safeway", matchedProductIds.safeway),
    qfcDirect: sourceTargets("qfc", matchedProductIds.qfc),
    instacartMissingStore,
    unresolvedComparisons: unresolved.slice(0, limit),
    traderJoesUnmatched,
  },
};

console.log(JSON.stringify(output, null, 2));
