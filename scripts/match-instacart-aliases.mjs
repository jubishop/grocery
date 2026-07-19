import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  numericProductVariantsCompatible,
  productQualifierEvidence,
  productQualifiersCompatible,
} from "./match-product-qualifiers.mjs";
import {
  packagedProductVariantsCompatible,
  productUrlVariantHints,
} from "./match-packaged-variants.mjs";
import { looseProduceMatches } from "./match-loose-produce.mjs";
import { looseMeatMatches } from "./match-loose-meat.mjs";
import { normalizeInstacartRecords } from "./normalize-instacart-pricing.mjs";
import { isSourceExclusiveProduct } from "./source-exclusive-products.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpointPath = path.join(root, "data/capture-checkpoint.json");
const weightDetailsPath = path.join(root, "data/instacart-weight-details.json");
const outputPath = path.join(root, "data/instacart-aliases.json");
const [checkpoint, weightDetails] = await Promise.all([
  readFile(checkpointPath, "utf8").then(JSON.parse),
  readFile(weightDetailsPath, "utf8").then(JSON.parse),
]);

const stores = ["pcc", "metro", "safeway", "qfc"];
const records = [...new Map(
  normalizeInstacartRecords(checkpoint.records, weightDetails)
    .map((record) => [`${record.storeId}|${record.id}`, record]),
).values()];

function plain(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase();
}

function normalizeQuantity(amount, unit) {
  const clean = unit.replace(/\./g, "").replace(/\s+/g, " ");
  if (/^(?:lb|lbs|pounds?)$/.test(clean)) return { dimension: "mass", amount: amount * 16 };
  if (/^(?:oz|ounces?)$/.test(clean)) return { dimension: "mass", amount };
  if (/^(?:g|grams?)$/.test(clean)) return { dimension: "mass", amount: amount / 28.349523125 };
  if (/^(?:kg|kilograms?)$/.test(clean)) return { dimension: "mass", amount: (amount * 1000) / 28.349523125 };
  if (/^(?:fl oz|fz|fluid ounces?)$/.test(clean)) return { dimension: "volume", amount };
  if (/^(?:ml|milliliters?)$/.test(clean)) return { dimension: "volume", amount: amount / 29.5735295625 };
  if (/^(?:l|liters?|litres?)$/.test(clean)) return { dimension: "volume", amount: (amount * 1000) / 29.5735295625 };
  return null;
}

function quantity(text) {
  const value = plain(text).replace(/\b(12ct|18ct|24ct|6ct|8ct|4ct)\b/g, (match) => match.replace("ct", " ct"));
  const prefixPack = value.match(/\b(\d+)\s*(?:pack|pk)\s*[,/-]?\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (prefixPack) return normalizeQuantity(Number(prefixPack[1]) * Number(prefixPack[2]), prefixPack[3]);
  const multiplied = value.match(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (multiplied) return normalizeQuantity(Number(multiplied[1]) * Number(multiplied[2]), multiplied[3]);
  const count = value.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
  if (count) return { dimension: "count", amount: Number(count[1]) };
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  return match ? normalizeQuantity(Number(match[1]), match[2]) : null;
}

const stopWords = new Set([
  "a", "an", "and", "the", "with", "made", "from", "for", "of", "in", "by",
  "natural", "naturals",
  "product", "products", "flavor", "flavored", "style", "premium", "ready", "serve",
  "ounce", "ounces", "fluid", "pound", "pounds", "count", "pack", "packs", "ct", "oz",
  "lb", "lbs", "ml", "liter", "liters", "gram", "grams", "g", "kg", "ea",
]);

function tokens(text) {
  return plain(text)
    .replace(/\b\d+(?:\.\d+)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreTokenSets(left, right) {
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  const containment = shared / Math.min(left.size, right.size);
  const jaccard = shared / new Set([...left, ...right]).size;
  return 0.7 * containment + 0.3 * jaccard;
}

function brandKey(name) {
  return tokens(name)[0] ?? "";
}

function bucket(record) {
  const parsed = quantity(record.size || record.name);
  if (!parsed) return null;
  const rounded = parsed.dimension === "count" ? parsed.amount : Math.round(parsed.amount * 20) / 20;
  return `${brandKey(record.name)}|${parsed.dimension}|${rounded}`;
}

function pricesPlausiblySamePackage(left, right) {
  const referencePrice = (record) => {
    const prices = [record.price, record.originalPrice]
      .map(Number)
      .filter((price) => Number.isFinite(price) && price > 0);
    return prices.length ? Math.max(...prices) : null;
  };
  const leftPrice = referencePrice(left);
  const rightPrice = referencePrice(right);
  if (!leftPrice || !rightPrice) return true;
  return Math.max(leftPrice, rightPrice) / Math.min(leftPrice, rightPrice) <= 3.25;
}

class UnionFind {
  constructor(values) {
    this.parent = new Map(values.map((value) => [value, value]));
  }
  find(value) {
    const parent = this.parent.get(value);
    if (parent !== value) this.parent.set(value, this.find(parent));
    return this.parent.get(value);
  }
  union(left, right) {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent.set(b, a.localeCompare(b, undefined, { numeric: true }) <= 0 ? a : b);
  }
}

const productIds = [...new Set(records.map((record) => record.id))];
const unionFind = new UnionFind(productIds);
const buckets = new Map();
const recordKey = (record) => `${record.storeId}|${record.id}`;
const recordMetadata = new Map(records.map((record) => [
  recordKey(record),
  {
    bucketKey: bucket(record),
    nameTokens: new Set(tokens(record.name)),
    qualifierEvidence: productQualifierEvidence(record),
    sourceExclusive: isSourceExclusiveProduct("instacart", record),
    variantText: `${record.name} ${record.size ?? ""} ${productUrlVariantHints(record.productUrl)}`,
  },
]));
for (const record of records) {
  const key = recordMetadata.get(recordKey(record)).bucketKey;
  if (!key) continue;
  const byStore = buckets.get(key) ?? new Map();
  const list = byStore.get(record.storeId) ?? [];
  list.push(record);
  byStore.set(record.storeId, list);
  buckets.set(key, byStore);
}

const pairAnalysisCache = new Map();
function pairAnalysis(left, right) {
  const keys = [recordKey(left), recordKey(right)].sort();
  const key = `${keys[0]}<>${keys[1]}`;
  const cached = pairAnalysisCache.get(key);
  if (cached) return cached;

  const leftMetadata = recordMetadata.get(recordKey(left));
  const rightMetadata = recordMetadata.get(recordKey(right));
  const looseCommodityMatch = looseProduceMatches(left, right) || looseMeatMatches(left, right);
  const compatible = (
    (
      (!leftMetadata.sourceExclusive && !rightMetadata.sourceExclusive)
      || looseCommodityMatch
    )
    && (looseCommodityMatch || pricesPlausiblySamePackage(left, right))
    && productQualifiersCompatible(
      leftMetadata.qualifierEvidence,
      rightMetadata.qualifierEvidence,
    )
    && numericProductVariantsCompatible(left.name, right.name)
    && packagedProductVariantsCompatible(
      leftMetadata.variantText,
      rightMetadata.variantText,
    )
  );
  const result = {
    compatible,
    score: compatible
      ? scoreTokenSets(leftMetadata.nameTokens, rightMetadata.nameTokens)
      : 0,
  };
  pairAnalysisCache.set(key, result);
  return result;
}

const bestByRecordAndStore = new Map();
for (const record of records) {
  const byStore = buckets.get(recordMetadata.get(recordKey(record)).bucketKey);
  if (!byStore) continue;
  for (const targetStore of stores) {
    if (targetStore === record.storeId) continue;
    const scored = [];
    for (const candidate of byStore.get(targetStore) ?? []) {
      if (candidate.id === record.id) continue;
      const analysis = pairAnalysis(record, candidate);
      if (analysis.compatible && analysis.score >= 0.82) {
        scored.push({ candidate, score: analysis.score });
      }
    }
    scored.sort((a, b) => (
      b.score - a.score
      || a.candidate.id.localeCompare(b.candidate.id, undefined, { numeric: true })
    ));
    if (!scored.length) continue;
    bestByRecordAndStore.set(`${record.storeId}|${record.id}|${targetStore}`, {
      record,
      candidate: scored[0].candidate,
      score: scored[0].score,
      margin: scored[0].score - (scored[1]?.score ?? 0),
    });
  }
}

const evidence = [];
for (const match of bestByRecordAndStore.values()) {
  const reverse = bestByRecordAndStore.get(`${match.candidate.storeId}|${match.candidate.id}|${match.record.storeId}`);
  if (!reverse || reverse.candidate.id !== match.record.id) continue;
  const strong = match.score >= 0.9 && (match.margin >= 0.08 || match.score >= 0.98);
  const reverseStrong = reverse.score >= 0.9 && (reverse.margin >= 0.08 || reverse.score >= 0.98);
  if (!strong || !reverseStrong) continue;
  unionFind.union(match.record.id, match.candidate.id);
  evidence.push({
    leftId: match.record.id,
    leftStore: match.record.storeId,
    leftName: match.record.name,
    rightId: match.candidate.id,
    rightStore: match.candidate.storeId,
    rightName: match.candidate.name,
    score: Number(match.score.toFixed(4)),
    method: "mutual_unique_brand_name_size",
  });
}

const clusters = new Map();
for (const record of records) {
  const canonicalId = unionFind.find(record.id);
  const cluster = clusters.get(canonicalId) ?? { canonicalId, productIds: new Set(), records: [] };
  cluster.productIds.add(record.id);
  cluster.records.push(record);
  clusters.set(canonicalId, cluster);
}

const serializedClusters = [...clusters.values()].map((cluster) => {
  const storeIds = [...new Set(cluster.records.map((record) => record.storeId))];
  return {
    canonicalId: cluster.canonicalId,
    productIds: [...cluster.productIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    storeIds,
    storeCount: storeIds.length,
    representativeName: cluster.records.sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0]?.name ?? "",
  };
}).sort((a, b) => a.representativeName.localeCompare(b.representativeName));

const aliasMap = {};
for (const cluster of serializedClusters) for (const productId of cluster.productIds) aliasMap[productId] = cluster.canonicalId;

const output = {
  generatedAt: new Date().toISOString(),
  methodology: "Exact Instacart IDs are preserved, then retailer-specific duplicate IDs are joined automatically only when brand, numeric variant, protected product claims, packaged-product state, equivalent package size, and a conservative packaged-price sanity check agree and the normalized names are mutually unique high-confidence matches. Captured URL slugs supply rejection-only variant hints and are never sufficient to accept a match. Ambiguous candidates are excluded.",
  counts: {
    records: records.length,
    productIds: productIds.length,
    aliasPairs: evidence.length,
    canonicalProducts: serializedClusters.length,
    allFour: serializedClusters.filter((cluster) => cluster.storeCount === 4).length,
  },
  aliases: aliasMap,
  clusters: serializedClusters,
  evidence,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
