import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  crossSourceQualifiersCompatible,
  numericProductVariantsCompatible,
  productQualifierEvidence,
} from "./match-product-qualifiers.mjs";
import {
  packagedProductVariantsCompatible,
  productUrlVariantHints,
} from "./match-packaged-variants.mjs";
import { looseProduceKey, looseProduceMatches } from "./match-loose-produce.mjs";
import { looseMeatKey, looseMeatMatches } from "./match-loose-meat.mjs";
import {
  normalizeDirectStoreRecords,
  normalizeInstacartRecords,
} from "./normalize-instacart-pricing.mjs";
import { isSourceExclusiveProduct } from "./source-exclusive-products.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
const instacartWeightDetailsPath = path.join(root, "data/instacart-weight-details.json");
const aliasesPath = path.join(root, "data/instacart-aliases.json");
const storeId = process.argv[2] ?? "safeway";
const configs = {
  safeway: {
    displayName: "Safeway",
    source: "safeway.com",
    directPath: path.join(root, "data/safeway-direct-capture-checkpoint.json"),
    outputPath: path.join(root, "data/safeway-direct-matches.json"),
  },
  qfc: {
    displayName: "QFC",
    source: "qfc.com",
    directPath: path.join(root, "data/qfc-direct-capture-checkpoint.json"),
    outputPath: path.join(root, "data/qfc-direct-matches.json"),
  },
};
const config = configs[storeId];
if (!config) throw new Error(`Unsupported direct store: ${storeId}`);

const [instacart, instacartWeightDetails, direct, aliases] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(instacartWeightDetailsPath, "utf8").then(JSON.parse),
  readFile(config.directPath, "utf8").then(JSON.parse),
  readFile(aliasesPath, "utf8").then(JSON.parse),
]);
instacart.records = normalizeInstacartRecords(instacart.records, instacartWeightDetails);
direct.records = normalizeDirectStoreRecords(direct.records);

const unitAliases = new Map([
  ["ounce", "oz"], ["ounces", "oz"], ["oz", "oz"],
  ["pound", "lb"], ["pounds", "lb"], ["lb", "lb"], ["lbs", "lb"],
  ["fluid ounce", "fl oz"], ["fluid ounces", "fl oz"], ["fl ounce", "fl oz"], ["fl ounces", "fl oz"], ["fl oz", "fl oz"],
  ["fz", "fl oz"],
  ["milliliter", "ml"], ["milliliters", "ml"], ["ml", "ml"],
  ["liter", "l"], ["liters", "l"], ["litre", "l"], ["litres", "l"], ["l", "l"],
  ["gram", "g"], ["grams", "g"], ["g", "g"],
  ["kilogram", "kg"], ["kilograms", "kg"], ["kg", "kg"],
  ["count", "ct"], ["ct", "ct"], ["ea", "ct"], ["each", "ct"],
]);

function plain(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase();
}

function queryKey(value) {
  return plain(value).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function normalizeQuantity(amount, rawUnit) {
  const cleanUnit = rawUnit.replace(/\./g, "").replace(/\s+/g, " ");
  const unit = unitAliases.get(cleanUnit) ?? cleanUnit;
  if (unit === "lb") return { dimension: "mass", amount: amount * 16, display: `${amount} lb` };
  if (unit === "oz") return { dimension: "mass", amount, display: `${amount} oz` };
  if (unit === "g") return { dimension: "mass", amount: amount / 28.349523125, display: `${amount} g` };
  if (unit === "kg") return { dimension: "mass", amount: (amount * 1000) / 28.349523125, display: `${amount} kg` };
  if (unit === "fl oz") return { dimension: "volume", amount, display: `${amount} fl oz` };
  if (unit === "ml") return { dimension: "volume", amount: amount / 29.5735295625, display: `${amount} ml` };
  if (unit === "l") return { dimension: "volume", amount: (amount * 1000) / 29.5735295625, display: `${amount} l` };
  if (unit === "ct") return { dimension: "count", amount, display: `${amount} ct` };
  return null;
}

function quantity(text) {
  const value = plain(text).replace(/\b(\d+)ct\b/g, "$1 ct");
  const slashPack = value.match(/\b(\d+)\s*(?:pack|pk)\s*(?:\/|x|×|-)\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (slashPack) return normalizeQuantity(Number(slashPack[2]) * Number(slashPack[1]), slashPack[3]);
  const hyphenPack = value.match(/\b(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (hyphenPack) return normalizeQuantity(Number(hyphenPack[2]) * Number(hyphenPack[1]), hyphenPack[3]);
  const multipack = value.match(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (multipack) return normalizeQuantity(Number(multipack[2]) * Number(multipack[1]), multipack[3]);
  const packOf = value.match(/\b(\d+)\s*(?:pack|pk)\s*[,/-]?\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (packOf) return normalizeQuantity(Number(packOf[1]) * Number(packOf[2]), packOf[3]);
  const count = value.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
  if (count) return normalizeQuantity(Number(count[1]), "ct");
  const matches = [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/g)];
  const match = matches.at(-1);
  if (!match) return null;
  return normalizeQuantity(Number(match[1]), match[2]);
}

function quantitiesAgree(left, right) {
  if (!left || !right || left.dimension !== right.dimension) return false;
  const tolerance = left.dimension === "count" ? 0 : Math.max(0.08, Math.min(left.amount, right.amount) * 0.025);
  return Math.abs(left.amount - right.amount) <= tolerance;
}

function quantityBucket(parsed) {
  if (!parsed) return null;
  if (parsed.dimension === "count") return `${parsed.dimension}:${parsed.amount}`;
  return `${parsed.dimension}:${Math.round(parsed.amount * 4) / 4}`;
}

function quantityBucketCandidates(index, parsed) {
  if (!parsed) return [];
  if (parsed.dimension === "count") return index.get(quantityBucket(parsed)) ?? [];
  const bucket = Math.round(parsed.amount * 4) / 4;
  const tolerance = Math.max(0.08, parsed.amount * 0.025);
  const radius = Math.ceil(tolerance * 4) + 1;
  return Array.from({ length: radius * 2 + 1 }, (_, indexOffset) => (
    bucket + (indexOffset - radius) / 4
  )).flatMap((candidateBucket) => (
    index.get(`${parsed.dimension}:${candidateBucket}`) ?? []
  ));
}

const stopWords = new Set([
  "a", "an", "and", "the", "with", "made", "from", "for", "of", "in", "by",
  "natural", "naturals",
  "frozen", "microwave", "meal", "meals", "food", "foods", "product", "products",
  "flavor", "flavored", "style", "premium", "ready", "serve", "your",
  "ounce", "ounces", "fluid", "pound", "pounds", "count", "pack", "packs", "ct", "oz",
  "lb", "lbs", "ml", "liter", "liters", "gram", "grams", "kg", "ea", "each",
]);

function tokens(text) {
  return plain(text)
    .replace(/\b\d+(?:\.\d+)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .map((token) => token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token);
}

function tokenScoreSets(left, right) {
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  const containment = shared / Math.min(left.size, right.size);
  const jaccard = shared / new Set([...left, ...right]).size;
  return 0.72 * containment + 0.28 * jaccard;
}

const genericLeadingWords = new Set([
  "classic", "extra", "farmstyle", "fresh", "large", "medium", "natural",
  "organic", "original", "premium", "small", "traditional", "value", "whole",
]);
const brandAliases = new Map([
  ["maeve", "seattle"],
  ["morning", "morningstar"],
  ["morningstar", "morningstar"],
]);

function brandTokens(text) {
  return plain(text)
    .replace(/\ba[\s.]*1\b/g, "a1")
    .replace(/\bm\s+and\s+m\b/g, "mms")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !genericLeadingWords.has(token))
    .map((token) => {
      const singular = token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token;
      return brandAliases.get(singular) ?? singular;
    });
}

function brandsCompatibleTokens(left, right, score) {
  const leftLead = left[0];
  const rightLead = right[0];
  if (!leftLead || !rightLead) return true;
  if (right.includes(leftLead) || left.includes(rightLead)) return true;
  // Very high name agreement also covers retailer titles that omit the brand
  // entirely, such as "Pinto Beans" for S&W Pinto Beans.
  return score >= 0.9;
}

function variantsCompatible(left, right, leftMetadata, rightMetadata) {
  if (!crossSourceQualifiersCompatible(
    leftMetadata.qualifierEvidence,
    rightMetadata.qualifierEvidence,
  )) return false;
  if (!numericProductVariantsCompatible(left.name, right.title)) return false;
  return packagedProductVariantsCompatible(
    leftMetadata.variantText,
    rightMetadata.variantText,
  );
}

const groups = new Map();
for (const record of instacart.records) {
  const canonicalId = aliases.aliases[record.id] ?? record.id;
  const group = groups.get(canonicalId) ?? { records: [], sourceProductIds: new Set(), storeIds: new Set() };
  group.records.push(record);
  group.sourceProductIds.add(record.id);
  group.storeIds.add(record.storeId);
  groups.set(canonicalId, group);
}

const storeItems = [...groups.entries()]
  .filter(([, group]) => (
    group.storeIds.has(storeId)
    || group.records.some((record) => looseProduceKey(record))
    || group.records.some((record) => looseMeatKey(record))
  ))
  .map(([productId, group]) => {
    const storeRecord = group.records.find((record) => record.storeId === storeId);
    const eligibleRecords = group.records.filter((record) => record.comparisonEligible !== false);
    const representativeRecord = (
      storeRecord?.comparisonEligible !== false ? storeRecord : null
    ) ?? eligibleRecords[0] ?? storeRecord ?? group.records[0];
    return {
      productId,
      sourceProductIds: [...group.sourceProductIds],
      storeIds: [...group.storeIds],
      storeCount: group.storeIds.size,
      name: representativeRecord.name,
      size: representativeRecord.size || "",
      category: representativeRecord.category || "",
      priceBasis: representativeRecord.priceBasis || "per item",
      productUrl: representativeRecord.productUrl || "",
      qualifierText: representativeRecord.qualifierText || "",
      comparisonEligible: eligibleRecords.length > 0,
      instacartPrice: storeRecord?.comparisonEligible !== false ? storeRecord?.price ?? null : null,
      instacartUrl: storeRecord?.comparisonEligible !== false ? storeRecord?.productUrl ?? "" : "",
      quantity: quantity(representativeRecord.size || representativeRecord.name),
    };
  });
const storeItemMetadata = new Map(storeItems.map((item) => [
  item.productId,
  {
    brandTokens: brandTokens(item.name),
    nameTokens: new Set(tokens(item.name)),
    qualifierEvidence: productQualifierEvidence(item),
    sourceExclusive: isSourceExclusiveProduct("instacart", item),
    variantText: `${item.name} ${item.size ?? ""} ${productUrlVariantHints(item.productUrl)}`,
  },
]));

const directRecordsWithQuantity = direct.records
  .map((record) => {
    const titleQuantity = quantity(record.title);
    const sizeQuantity = quantity(record.size);
    // Safeway's card-level size field drops decimal precision (for example,
    // "9.5 oz" becomes "9 oz"), while the full card title retains it. QFC's
    // structured size is reliable and avoids mistaking nutrition claims in a
    // title for package quantity.
    const recordQuantity = storeId === "safeway"
      ? titleQuantity ?? sizeQuantity
      : sizeQuantity ?? titleQuantity;
    return { ...record, quantity: recordQuantity };
  })
  .filter((record) => record.quantity);
const directWithQuantity = directRecordsWithQuantity
  .filter((record) => record.comparisonEligible !== false)
  .filter((record) => !isSourceExclusiveProduct(config.source, record));
const directMetadata = new Map(directWithQuantity.map((record) => [
  record.id,
  {
    brandTokens: brandTokens(record.title),
    nameTokens: new Set(tokens(record.title)),
    qualifierEvidence: productQualifierEvidence(record),
    variantText: `${record.title} ${record.size ?? ""} ${productUrlVariantHints(record.productUrl)}`,
  },
]));
const directById = new Map(directWithQuantity.map((record) => [record.id, record]));
const directByQuantity = new Map();
const directByCapturedQuery = new Map();
for (const record of directWithQuantity) {
  const bucket = quantityBucket(record.quantity);
  if (bucket) {
    const candidates = directByQuantity.get(bucket) ?? [];
    candidates.push(record);
    directByQuantity.set(bucket, candidates);
  }
  const key = queryKey(record.query);
  if (key) {
    const candidates = directByCapturedQuery.get(key) ?? [];
    candidates.push(record);
    directByCapturedQuery.set(key, candidates);
  }
}
const looseProduceByKey = new Map();
const looseMeatByKey = new Map();
for (const record of direct.records) {
  const produceKey = looseProduceKey(record);
  if (produceKey) {
    const candidates = looseProduceByKey.get(produceKey) ?? [];
    candidates.push(record);
    looseProduceByKey.set(produceKey, candidates);
  }
  const meatKey = looseMeatKey(record);
  if (meatKey) {
    const candidates = looseMeatByKey.get(meatKey) ?? [];
    candidates.push(record);
    looseMeatByKey.set(meatKey, candidates);
  }
}
const resultIdsByQuery = new Map();
const resultIdsByProduct = new Map();
for (const query of direct.queries) {
  if (!Array.isArray(query.ids)) continue;
  const key = queryKey(query.query);
  const ids = resultIdsByQuery.get(key) ?? new Set();
  for (const id of query.ids) ids.add(id);
  resultIdsByQuery.set(key, ids);
  if (query.targetProductId) {
    const productIds = resultIdsByProduct.get(query.targetProductId) ?? new Set();
    for (const id of query.ids) productIds.add(id);
    resultIdsByProduct.set(query.targetProductId, productIds);
  }
}
const directQuantityCandidates = new Map();
function matchingQuantityCandidates(parsed) {
  const key = `${parsed.dimension}:${parsed.amount}`;
  const cached = directQuantityCandidates.get(key);
  if (cached) return cached;
  const candidates = quantityBucketCandidates(directByQuantity, parsed)
    .filter((record) => quantitiesAgree(parsed, record.quantity));
  directQuantityCandidates.set(key, candidates);
  return candidates;
}

const accepted = [];
for (const item of storeItems) {
  const itemMetadata = storeItemMetadata.get(item.productId);
  const left = {
    name: item.name,
    size: item.size,
    category: item.category,
    priceBasis: item.priceBasis,
    productUrl: item.productUrl,
    qualifierText: item.qualifierText,
    comparisonEligible: item.comparisonEligible,
  };
  const produceKey = looseProduceKey(left);
  const meatKey = looseMeatKey(left);
  const loosePool = produceKey
    ? looseProduceByKey.get(produceKey) ?? []
    : meatKey
      ? looseMeatByKey.get(meatKey) ?? []
      : [];
  const looseCandidates = loosePool.filter((record) => {
    const right = { ...record, category: record.category || item.category };
    return looseProduceMatches(left, right) || looseMeatMatches(left, right);
  });
  if (looseCandidates.length === 1) {
    const record = looseCandidates[0];
    const isProduce = looseProduceMatches(
    {
      name: item.name,
      size: item.size,
      category: item.category,
      priceBasis: item.priceBasis,
      productUrl: item.productUrl,
      qualifierText: item.qualifierText,
      comparisonEligible: item.comparisonEligible,
    },
    { ...record, category: record.category || item.category },
    );
    accepted.push({
      productId: item.productId,
      sourceProductIds: item.sourceProductIds,
      storeIds: item.storeIds,
      storeCount: item.storeCount,
      instacartName: item.name,
      instacartSize: item.size,
      instacartPrice: item.instacartPrice,
      instacartUrl: item.instacartUrl,
      directId: record.id,
      directTitle: record.title,
      directSize: record.size || record.priceBasis || item.priceBasis,
      directPrice: record.price,
      directOriginalPrice: record.originalPrice,
      directUrl: record.productUrl,
      capturedAt: record.capturedAt,
      capturedQuery: record.query,
      matchMethod: isProduce
        ? "normalized_loose_produce_name_basis"
        : "normalized_loose_meat_name_claims_basis",
      matchScore: 1,
      matchMargin: 1,
      sizeEvidence: isProduce
        ? `same loose produce name and ${record.priceBasis || item.priceBasis} selling basis`
        : "same loose meat cut, protected claims, and per lb selling basis",
      priceDifference: item.instacartPrice == null ? null : Number((item.instacartPrice - record.price).toFixed(2)),
      instacartMarkupPercent: item.instacartPrice == null ? null : Number(((item.instacartPrice / record.price - 1) * 100).toFixed(1)),
    });
    continue;
  }
  if (itemMetadata.sourceExclusive) continue;
  if (!item.quantity) continue;
  const expectedQueryKey = queryKey(`${item.name} ${item.size}`.trim());
  const targetedResultIds = resultIdsByProduct.get(item.productId);
  const exactResultIds = targetedResultIds ?? resultIdsByQuery.get(expectedQueryKey);
  const exactQueryRecords = exactResultIds
    ? [...exactResultIds].map((id) => directById.get(id)).filter(Boolean)
    : directByCapturedQuery.get(expectedQueryKey) ?? [];
  const candidatePool = exactQueryRecords.length
    ? exactQueryRecords.filter((record) => quantitiesAgree(item.quantity, record.quantity))
    : matchingQuantityCandidates(item.quantity);
  const candidates = candidatePool
    .map((record) => {
      const metadata = directMetadata.get(record.id);
      return {
        record,
        metadata,
        score: tokenScoreSets(itemMetadata.nameTokens, metadata.nameTokens),
      };
    })
    .filter(({ record, metadata, score }) => (
      brandsCompatibleTokens(
        itemMetadata.brandTokens,
        metadata.brandTokens,
        score,
      )
      && variantsCompatible(
        item,
        record,
        itemMetadata,
        metadata,
      )
    ))
    .filter(({ score }) => score >= 0.48)
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
  const best = candidates[0];
  const next = candidates[1];
  if (!best) continue;
  const margin = best.score - (next?.score ?? 0);
  const result = {
    productId: item.productId,
    sourceProductIds: item.sourceProductIds,
    storeIds: item.storeIds,
    storeCount: item.storeCount,
    instacartName: item.name,
    instacartSize: item.size,
    instacartPrice: item.instacartPrice,
    instacartUrl: item.instacartUrl,
    directId: best.record.id,
    directTitle: best.record.title,
    directSize: storeId === "safeway" ? best.record.quantity.display : best.record.size,
    directPrice: best.record.price,
    directOriginalPrice: best.record.originalPrice,
    directUrl: best.record.productUrl,
    capturedAt: best.record.capturedAt,
    capturedQuery: best.record.query,
    matchMethod: targetedResultIds
      ? "targeted_query_name_size"
      : exactQueryRecords.length
        ? "exact_query_name_size"
        : "normalized_name_size",
    matchScore: Number(best.score.toFixed(4)),
    matchMargin: Number(margin.toFixed(4)),
    sizeEvidence: `${item.quantity.display} = ${best.record.quantity.display}`,
    priceDifference: item.instacartPrice == null
      ? null
      : Number((item.instacartPrice - best.record.price).toFixed(2)),
    instacartMarkupPercent: item.instacartPrice == null
      ? null
      : Number(((item.instacartPrice / best.record.price - 1) * 100).toFixed(1)),
  };
  const isAccepted = (
    exactQueryRecords.length
      ? best.score >= 0.6 && (margin >= 0.05 || best.score >= 0.85)
      : best.score >= 0.78 && (margin >= 0.1 || best.score >= 0.93)
  );
  if (isAccepted) accepted.push(result);
}

const uniqueAccepted = accepted
  .sort((a, b) => b.storeCount - a.storeCount || b.matchScore - a.matchScore || b.matchMargin - a.matchMargin)
  .filter((match, index, matches) => (
    matches.findIndex((candidate) => candidate.directId === match.directId) === index
    && matches.findIndex((candidate) => candidate.productId === match.productId) === index
  ))
  .sort((a, b) => a.instacartName.localeCompare(b.instacartName));

const markupMatches = uniqueAccepted.filter((match) => Number.isFinite(match.priceDifference));
const priceDifferences = markupMatches.map((match) => match.priceDifference).sort((a, b) => a - b);
const output = {
  generatedAt: new Date().toISOString(),
  storeId,
  source: config.source,
  methodology: `Fully automatic conservative ${config.displayName} direct-catalog crosswalk requiring equivalent package quantity and numeric variants, agreement on protected product claims, no conflicting packaged-product state, strong normalized product-name agreement, and an unambiguous best candidate. Captured URL slugs supply rejection-only variant hints and are never sufficient to accept a match. Retailer-exclusive house brands are excluded from packaged matching, while exact loose commodity produce and meat may still match after retailer branding is removed. Loose produce may match by exact normalized produce name, organic/variety wording, and selling basis. Loose meat and seafood may match only by exact normalized raw cut, explicitly captured per-pound basis, and agreement on organic, grass-fed, pasture-raised, free-range, air-chilled, wild/farmed, bone, skin, frozen, lean-percentage, grade, Angus, heritage, antibiotic, natural, rib-meat, value-pack, and retained-water claims. Poultry additionally requires product-detail qualifier evidence on both sides. Unmatched or ambiguous candidates are excluded automatically without falling back to Instacart.`,
  counts: {
    instacartStoreProducts: storeItems.length,
    directProductsCaptured: direct.records.length,
    directMatchingCandidates: directWithQuantity.length,
    accepted: uniqueAccepted.length,
    acceptedByStoreCount: Object.fromEntries([1, 2, 3, 4].map((count) => [count, uniqueAccepted.filter((match) => match.storeCount === count).length])),
  },
  markupSummary: {
    comparedProducts: markupMatches.length,
    instacartHigherCount: markupMatches.filter((match) => match.priceDifference > 0).length,
    directHigherCount: markupMatches.filter((match) => match.priceDifference < 0).length,
    samePriceCount: markupMatches.filter((match) => match.priceDifference === 0).length,
    totalInstacart: Number(markupMatches.reduce((sum, match) => sum + match.instacartPrice, 0).toFixed(2)),
    totalDirect: Number(markupMatches.reduce((sum, match) => sum + match.directPrice, 0).toFixed(2)),
    medianDifference: priceDifferences[Math.floor(priceDifferences.length / 2)] ?? 0,
  },
  matches: uniqueAccepted,
};

await writeFile(config.outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ counts: output.counts, markupSummary: output.markupSummary }, null, 2));
