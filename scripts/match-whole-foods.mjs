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
import { normalizeInstacartRecords } from "./normalize-instacart-pricing.mjs";
import { isSourceExclusiveProduct } from "./source-exclusive-products.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
const instacartWeightDetailsPath = path.join(root, "data/instacart-weight-details.json");
const wholeFoodsPath = path.join(root, "data/whole-foods-capture-checkpoint.json");
const outputPath = path.join(root, "data/whole-foods-matches.json");
const aliasesPath = path.join(root, "data/instacart-aliases.json");

const [instacart, instacartWeightDetails, wholeFoods, aliases] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(instacartWeightDetailsPath, "utf8").then(JSON.parse),
  readFile(wholeFoodsPath, "utf8").then(JSON.parse),
  readFile(aliasesPath, "utf8").then(JSON.parse),
]);
instacart.records = normalizeInstacartRecords(instacart.records, instacartWeightDetails);

const storeIds = ["pcc", "metro", "safeway", "qfc"];
const groups = new Map();
for (const record of instacart.records) {
  const canonicalId = aliases.aliases[record.id] ?? record.id;
  const group = groups.get(canonicalId) ?? { byStore: new Map(), productIds: new Set() };
  group.byStore.set(record.storeId, record);
  group.productIds.add(record.id);
  groups.set(canonicalId, group);
}

const allInstacart = [...groups.entries()]
  .map(([id, group]) => {
    const { byStore, productIds } = group;
    const records = [...byStore.values()];
    const eligibleRecords = records.filter((record) => record.comparisonEligible !== false);
    const representative = (eligibleRecords.length ? eligibleRecords : records)
      .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0];
    return {
      id,
      sourceProductIds: [...productIds],
      name: representative.name,
      size: representative.size || "",
      category: representative.category || "Other Groceries",
      priceBasis: representative.priceBasis || "per item",
      productUrl: representative.productUrl || "",
      qualifierText: representative.qualifierText || "",
      comparisonEligible: eligibleRecords.length > 0,
      storeIds: [...byStore.keys()],
      storeCount: byStore.size,
    };
  });
const allFour = allInstacart.filter((item) => storeIds.every((storeId) => item.storeIds.includes(storeId)));

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
    .replace(/[®™©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/\bunsweetned\b/g, "unsweetened")
    .replace(/\bmilk\s+macadamia\b/g, "milkadamia");
}

function queryKey(value) {
  return plain(value).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function quantity(text) {
  const value = plain(text).replace(/\b(12ct|18ct|24ct|6ct|8ct|4ct)\b/g, (match) => match.replace("ct", " ct"));
  const unitForContext = (rawUnit) => (
    /^(?:ounces?|oz)$/i.test(rawUnit.replace(/\./g, ""))
    && /\b(?:beverage|broth|coffee|creamer|drink|juice|kombucha|milk|milkadamia|almondmilk|oatmilk|soymilk|coconutmilk|oil|sauce|soda|soup|stock|tea|vinegar|water)\b/.test(value)
    && !/\b(?:beef|chicken|fish|meat|pork|salmon|shrimp|tuna)\b/.test(value)
      ? "fl oz"
      : rawUnit
  );
  const prefixPack = value.match(/\b(\d+)\s*(?:pack|pk)\s*[,/-]?\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (prefixPack) return normalizeQuantity(
    Number(prefixPack[2]) * Number(prefixPack[1]),
    unitForContext(prefixPack[3]),
  );
  const multipack = value.match(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (multipack) return normalizeQuantity(
    Number(multipack[2]) * Number(multipack[1]),
    unitForContext(multipack[3]),
  );

  const match = value.match(/\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (!match) {
    const count = value.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
    return count
      ? { dimension: "count", amount: Number(count[1]), display: `${count[1]} ct` }
      : null;
  }
  const packSuffix = value.slice(match.index + match[0].length);
  const packMatch = packSuffix.match(/\b(?:(\d+)\s*pack|pack\s+of\s+(\d+))\b/);
  const multiplier = Number(packMatch?.[1] ?? packMatch?.[2] ?? 1);
  return normalizeQuantity(Number(match[1]) * multiplier, unitForContext(match[2]));
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
  return null;
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
  "flavor", "flavored", "style", "premium", "ready", "serve",
  "brand", "co", "company", "family", "kitchen", "market",
  "ounce", "ounces", "fluid", "pound", "pounds", "count", "pack", "packs", "ct", "oz",
  "lb", "lbs", "ml", "liter", "liters", "gram", "grams", "g", "kg", "ea",
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

function tokenScore(leftText, rightText) {
  const left = new Set(tokens(leftText));
  const right = new Set(tokens(rightText));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  const containment = shared / Math.min(left.size, right.size);
  const jaccard = shared / new Set([...left, ...right]).size;
  return 0.7 * containment + 0.3 * jaccard;
}

const genericBrandWords = new Set([
  "classic", "fresh", "natural", "organic", "original", "premium", "traditional",
]);

function brandAgrees(instacartName, amazonBrand, amazonTitle) {
  const brandTokens = tokens(amazonBrand);
  const nameTokens = new Set(tokens(instacartName));
  if (brandTokens.length) {
    if (brandTokens.every((token) => nameTokens.has(token))) return true;
    return brandTokens.length === 1 && nameTokens.has(brandTokens[0]);
  }
  const titleLead = tokens(amazonTitle).find((token) => !genericBrandWords.has(token));
  return Boolean(titleLead && nameTokens.has(titleLead));
}

const wholeFoodsRecords = wholeFoods.records
  .map((record) => ({
    ...record,
    quantity: quantity(record.detailSize || record.title),
  }));
const wholeFoodsCandidates = wholeFoodsRecords
  .filter((record) => !isSourceExclusiveProduct("amazon_whole_foods", record));
const wholeFoodsByAsin = new Map(wholeFoodsCandidates.map((record) => [record.asin, record]));
const wholeFoodsByQuantity = new Map();
const looseProduceByKey = new Map();
const looseMeatByKey = new Map();
for (const record of wholeFoodsRecords) {
  const bucket = quantityBucket(record.quantity);
  if (bucket && !isSourceExclusiveProduct("amazon_whole_foods", record)) {
    const candidates = wholeFoodsByQuantity.get(bucket) ?? [];
    candidates.push(record);
    wholeFoodsByQuantity.set(bucket, candidates);
  }
  const produceKey = looseProduceKey({ ...record, category: "Produce" });
  if (produceKey) {
    const candidates = looseProduceByKey.get(produceKey) ?? [];
    candidates.push(record);
    looseProduceByKey.set(produceKey, candidates);
  }
  const meatKey = looseMeatKey({ ...record, category: "Meat & Seafood" });
  if (meatKey) {
    const candidates = looseMeatByKey.get(meatKey) ?? [];
    candidates.push(record);
    looseMeatByKey.set(meatKey, candidates);
  }
}

const allMatches = [];
const queryByKey = new Map(wholeFoods.queries.map((query) => [queryKey(query.query), query]));
const queryByProductId = new Map(
  wholeFoods.queries
    .filter((query) => query.targetProductId)
    .map((query) => [String(query.targetProductId), query]),
);
for (const item of allInstacart) {
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
  const looseCandidates = loosePool.filter((candidate) => {
    const right = { ...candidate, category: item.category };
    return looseProduceMatches(left, right) || looseMeatMatches(left, right);
  });
  if (looseCandidates.length === 1) {
    const candidate = looseCandidates[0];
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
      { ...candidate, category: candidate.category || item.category },
    );
    allMatches.push({
      productId: item.id,
      sourceProductIds: item.sourceProductIds,
      instacartName: item.name,
      instacartSize: item.size,
      category: item.category,
      storeIds: item.storeIds,
      storeCount: item.storeCount,
      asin: candidate.asin,
      wholeFoodsTitle: candidate.title,
      wholeFoodsPrice: candidate.price,
      wholeFoodsUrl: candidate.productUrl,
      wholeFoodsImageUrl: candidate.imageUrl,
      capturedAt: candidate.capturedAt,
      matchMethod: isProduce
        ? "normalized_loose_produce_name_basis"
        : "normalized_loose_meat_name_claims_basis",
      matchScore: 1,
      matchMargin: 1,
      sizeEvidence: isProduce
        ? "same loose produce name and selling basis"
        : "same loose meat cut, protected claims, and per lb selling basis",
    });
    continue;
  }
  if (isSourceExclusiveProduct("instacart", left)) continue;
  const itemQuantity = quantity(item.size || item.name);
  if (!itemQuantity) continue;
  const expectedQuery = `${item.name} ${item.size || ""}`.trim();
  const targetedQuery = queryByProductId.get(String(item.id));
  const exactQuery = targetedQuery ?? queryByKey.get(queryKey(expectedQuery));
  const exactAsinList = exactQuery?.asins ?? [];
  const exactAsins = new Set(exactAsinList);
  const rankByAsin = new Map(exactAsinList.map((asin, index) => [asin, index + 1]));
  const preferredRecords = exactAsins.size
    ? exactAsinList.map((asin) => wholeFoodsByAsin.get(asin)).filter(Boolean)
    : quantityBucketCandidates(wholeFoodsByQuantity, itemQuantity);
  let candidates = preferredRecords
    .map((candidate) => {
      const candidateQuantity = candidate.quantity;
      if (!quantitiesAgree(itemQuantity, candidateQuantity)) return null;
      if (!brandAgrees(item.name, candidate.brand, candidate.title)) return null;
      if (!crossSourceQualifiersCompatible(productQualifierEvidence(item), productQualifierEvidence(candidate))) return null;
      if (!numericProductVariantsCompatible(item.name, candidate.title)) return null;
      if (!packagedProductVariantsCompatible(
        `${item.name} ${item.size} ${productUrlVariantHints(item.productUrl)}`,
        `${candidate.title} ${candidate.detailSize ?? ""} ${productUrlVariantHints(candidate.productUrl)}`,
      )) return null;
      const score = tokenScore(item.name, `${candidate.brand ?? ""} ${candidate.title}`);
      return {
        candidate,
        candidateQuantity,
        score,
        queryRank: rankByAsin.get(candidate.asin) ?? Number.POSITIVE_INFINITY,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      targetedQuery
        ? a.queryRank - b.queryRank || b.score - a.score
        : b.score - a.score || a.candidate.title.localeCompare(b.candidate.title)
    ));
  if (!candidates.length && exactAsins.size) {
    candidates = quantityBucketCandidates(wholeFoodsByQuantity, itemQuantity)
      .map((candidate) => {
        const candidateQuantity = candidate.quantity;
        if (!quantitiesAgree(itemQuantity, candidateQuantity)) return null;
        if (!brandAgrees(item.name, candidate.brand, candidate.title)) return null;
        if (!crossSourceQualifiersCompatible(productQualifierEvidence(item), productQualifierEvidence(candidate))) return null;
        if (!numericProductVariantsCompatible(item.name, candidate.title)) return null;
        if (!packagedProductVariantsCompatible(
          `${item.name} ${item.size} ${productUrlVariantHints(item.productUrl)}`,
          `${candidate.title} ${candidate.detailSize ?? ""} ${productUrlVariantHints(candidate.productUrl)}`,
        )) return null;
        const score = tokenScore(item.name, `${candidate.brand ?? ""} ${candidate.title}`);
        return {
          candidate,
          candidateQuantity,
          score,
          queryRank: Number.POSITIVE_INFINITY,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));
  }

  const best = candidates[0];
  const next = candidates[1];
  if (!best) continue;
  const margin = best.score - (next?.score ?? 0);
  const result = {
    productId: item.id,
    sourceProductIds: item.sourceProductIds,
    instacartName: item.name,
    instacartSize: item.size,
    category: item.category,
    storeIds: item.storeIds,
    storeCount: item.storeCount,
    asin: best.candidate.asin,
    wholeFoodsTitle: best.candidate.title,
    wholeFoodsPrice: best.candidate.price,
    wholeFoodsUrl: best.candidate.productUrl,
    wholeFoodsImageUrl: best.candidate.imageUrl,
    capturedAt: best.candidate.capturedAt,
    matchMethod: targetedQuery && exactAsins.has(best.candidate.asin)
      ? "targeted_query_brand_name_size"
      : exactAsins.has(best.candidate.asin)
        ? "exact_query_brand_name_size"
      : "normalized_brand_name_size",
    matchScore: Number(best.score.toFixed(4)),
    matchMargin: Number(margin.toFixed(4)),
    sizeEvidence: `${itemQuantity.display} = ${best.candidateQuantity.display}`,
  };
  const acceptedByTargetedQuery = Boolean(
    targetedQuery
    && exactAsins.has(best.candidate.asin)
    && best.score >= 0.58
  );
  const acceptedByGeneralMatch = !targetedQuery
    && best.score >= 0.72
    && (margin >= 0.08 || best.score >= 0.9);
  if (acceptedByTargetedQuery || acceptedByGeneralMatch) {
    allMatches.push(result);
  }
}

const uniqueMatches = [...allMatches]
  .sort((a, b) => (
    b.storeCount - a.storeCount
    || b.matchScore - a.matchScore
    || b.matchMargin - a.matchMargin
    || a.productId.localeCompare(b.productId, undefined, { numeric: true })
  ))
  .filter((match, index, matches) => (
    matches.findIndex((candidate) => candidate.asin === match.asin) === index
    && matches.findIndex((candidate) => candidate.productId === match.productId) === index
  ));
const matches = uniqueMatches.filter((match) => match.storeCount === 4);

const output = {
  generatedAt: new Date().toISOString(),
  methodology: "Fully automatic conservative crosswalk requiring normalized brand and product agreement, equivalent package quantity and numeric variants, agreement on protected product claims, and no conflicting packaged-product state. Captured URL slugs supply rejection-only variant hints and are never sufficient to accept a match. Exact product-targeted searches may accept only their first priced result after all automatic compatibility gates pass. Loose produce may match by exact normalized produce name, organic/variety wording, and selling basis. Loose meat and seafood may match only by exact normalized raw cut, explicitly captured per-pound basis, and agreement on organic, grass-fed, pasture-raised, free-range, air-chilled, wild/farmed, bone, skin, frozen, lean-percentage, grade, Angus, heritage, antibiotic, natural, rib-meat, value-pack, and retained-water claims. Poultry additionally requires product-detail qualifier evidence on both sides. Retailer-exclusive house brands and ambiguous candidates are excluded automatically.",
  counts: {
    instacartAllFour: allFour.length,
    wholeFoodsCaptured: wholeFoods.records.length,
    wholeFoodsMatchingCandidates: wholeFoodsCandidates.length,
    accepted: matches.length,
    acceptedAnyStoreCount: uniqueMatches.length,
    acceptedByStoreCount: Object.fromEntries([1, 2, 3, 4].map((count) => [count, uniqueMatches.filter((match) => match.storeCount === count).length])),
  },
  matches: matches.sort((a, b) => a.instacartName.localeCompare(b.instacartName)),
  allMatches: uniqueMatches.sort((a, b) => b.storeCount - a.storeCount || a.instacartName.localeCompare(b.instacartName)),
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
