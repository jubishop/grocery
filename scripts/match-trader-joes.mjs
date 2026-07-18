import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeInstacartRecords,
} from "./normalize-instacart-pricing.mjs";
import {
  traderJoesCommodityFamily,
  traderJoesCommodityMatch,
} from "./match-trader-joes-commodities.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => path.join(root, "data", name);
const [
  capture,
  instacart,
  instacartWeightDetails,
  aliases,
  wholeFoodsMatches,
  safewayMatches,
  qfcMatches,
] = await Promise.all([
  readFile(dataPath("trader-joes-capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("capture-checkpoint.json"), "utf8").then(JSON.parse),
  readFile(dataPath("instacart-weight-details.json"), "utf8").then(JSON.parse),
  readFile(dataPath("instacart-aliases.json"), "utf8").then(JSON.parse),
  readFile(dataPath("whole-foods-matches.json"), "utf8").then(JSON.parse),
  readFile(dataPath("safeway-direct-matches.json"), "utf8").then(JSON.parse),
  readFile(dataPath("qfc-direct-matches.json"), "utf8").then(JSON.parse),
]);

const groups = new Map();
for (const record of normalizeInstacartRecords(instacart.records, instacartWeightDetails)) {
  const productId = aliases.aliases[record.id] ?? record.id;
  const group = groups.get(productId) ?? {
    productId,
    records: [],
    currentStoreIds: new Set(),
  };
  group.records.push(record);
  if (["pcc", "metro"].includes(record.storeId) && record.comparisonEligible !== false) {
    group.currentStoreIds.add(record.storeId);
  }
  groups.set(productId, group);
}
for (const match of wholeFoodsMatches.allMatches ?? wholeFoodsMatches.matches) {
  groups.get(match.productId)?.currentStoreIds.add("wholefoods");
}
for (const match of safewayMatches.matches) groups.get(match.productId)?.currentStoreIds.add("safeway");
for (const match of qfcMatches.matches) groups.get(match.productId)?.currentStoreIds.add("qfc");

const eligibleRecords = capture.records
  .map((record) => ({ ...record, commodityFamily: traderJoesCommodityFamily(record) }))
  .filter((record) => record.commodityFamily);
const groupsByFamily = new Map();
for (const group of groups.values()) {
  if (!group.currentStoreIds.size) continue;
  for (const record of group.records) {
    const family = traderJoesCommodityFamily(record);
    if (!family) continue;
    const familyGroups = groupsByFamily.get(family) ?? new Map();
    familyGroups.set(group.productId, group);
    groupsByFamily.set(family, familyGroups);
  }
}
const candidates = [];
for (const record of eligibleRecords) {
  for (const group of groupsByFamily.get(record.commodityFamily)?.values() ?? []) {
    let bestEvidence = null;
    let representative = null;
    for (const candidate of group.records) {
      const result = traderJoesCommodityMatch(record, candidate);
      if (!result.matched) continue;
      bestEvidence = result;
      representative = candidate;
      break;
    }
    if (!bestEvidence) continue;
    candidates.push({
      productId: group.productId,
      currentStoreCount: group.currentStoreIds.size,
      currentStoreIds: [...group.currentStoreIds].sort(),
      traderJoesId: record.id,
      traderJoesTitle: record.title,
      traderJoesSize: record.size,
      traderJoesPrice: record.price,
      traderJoesUrl: record.productUrl,
      capturedAt: record.capturedAt,
      commodityFamily: record.commodityFamily,
      canonicalName: representative.name,
      canonicalSize: representative.size || "",
      matchMethod: record.commodityFamily === "raw-meat"
        ? "normalized_loose_meat_name_claims_basis"
        : "strict_generic_commodity_signature_size",
      matchScore: 1,
      matchMargin: 1,
      sizeEvidence: bestEvidence.signature,
    });
  }
}

const candidatesBySource = new Map();
for (const candidate of candidates) {
  const sourceCandidates = candidatesBySource.get(candidate.traderJoesId) ?? [];
  sourceCandidates.push(candidate);
  candidatesBySource.set(candidate.traderJoesId, sourceCandidates);
}
const ambiguousSourceIds = new Set();
const sourceResolved = [];
for (const [traderJoesId, sourceCandidates] of candidatesBySource) {
  sourceCandidates.sort((left, right) => (
    right.currentStoreCount - left.currentStoreCount
    || left.productId.localeCompare(right.productId, undefined, { numeric: true })
  ));
  if (
    sourceCandidates.length > 1
    && sourceCandidates[0].currentStoreCount === sourceCandidates[1].currentStoreCount
  ) {
    ambiguousSourceIds.add(traderJoesId);
    continue;
  }
  sourceResolved.push(sourceCandidates[0]);
}
const targetCounts = new Map();
for (const match of sourceResolved) {
  targetCounts.set(match.productId, (targetCounts.get(match.productId) ?? 0) + 1);
}
const ambiguousTargetIds = new Set(
  [...targetCounts].filter(([, count]) => count > 1).map(([productId]) => productId),
);
const matches = sourceResolved
  .filter((match) => !ambiguousTargetIds.has(match.productId))
  .sort((left, right) => left.traderJoesTitle.localeCompare(right.traderJoesTitle));

const matchedIds = new Set(matches.map((match) => match.traderJoesId));
const output = {
  generatedAt: new Date().toISOString(),
  storeId: "traderjoes",
  source: "traderjoes.com",
  methodology: "Fully automatic strict Trader Joe's commodity crosswalk. Prepared, seasoned, mixed, novelty, and first-party-exclusive products are rejected before matching. Plain produce requires the same normalized variety, organic status, selling basis, and exact fixed package quantity when packaged. Raw meat and seafood require the same normalized raw cut, an explicit per-pound basis, and exact agreement on all protected production, cut, grade, frozen, and animal-raising claims. Eggs, dairy, baking staples, beans, grains, oils, salt, and plain cheese require an exact controlled commodity signature plus exact package quantity. A candidate is accepted only when it has strictly greater existing store coverage than every other matching canonical group; tied source candidates and duplicate target assignments are excluded automatically.",
  counts: {
    capturedProducts: capture.records.length,
    commodityEligible: eligibleRecords.length,
    excludedExclusiveOrPrepared: capture.records.length - eligibleRecords.length,
    accepted: matches.length,
    unmatchedEligible: eligibleRecords.length - matchedIds.size,
    ambiguousSourceCandidates: ambiguousSourceIds.size,
    ambiguousTargetAssignments: ambiguousTargetIds.size,
    acceptedByFamily: Object.fromEntries(
      [...new Set(eligibleRecords.map((record) => record.commodityFamily))]
        .sort()
        .map((family) => [family, matches.filter((match) => match.commodityFamily === family).length]),
    ),
  },
  eligibleIds: eligibleRecords.map((record) => record.id).sort(),
  matches,
};

await writeFile(dataPath("trader-joes-matches.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ counts: output.counts }, null, 2));
