import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  crossSourceQualifiersCompatible,
  numericProductVariantsCompatible,
  productQualifierEvidence,
} from "./match-product-qualifiers.mjs";
import { looseProduceMatches } from "./match-loose-produce.mjs";
import { looseMeatMatches } from "./match-loose-meat.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
const wholeFoodsPath = path.join(root, "data/whole-foods-capture-checkpoint.json");
const outputPath = path.join(root, "data/whole-foods-matches.json");
const aliasesPath = path.join(root, "data/instacart-aliases.json");

const [instacart, wholeFoods, aliases] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(wholeFoodsPath, "utf8").then(JSON.parse),
  readFile(aliasesPath, "utf8").then(JSON.parse),
]);

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
    const representative = records.sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0];
    return {
      id,
      sourceProductIds: [...productIds],
      name: representative.name,
      size: representative.size || "",
      category: representative.category || "Other Groceries",
      priceBasis: representative.priceBasis || "per item",
      productUrl: representative.productUrl || "",
      qualifierText: representative.qualifierText || "",
      storeIds: [...byStore.keys()],
      storeCount: byStore.size,
    };
  });
const allFour = allInstacart.filter((item) => storeIds.every((storeId) => item.storeIds.includes(storeId)));

const unitAliases = new Map([
  ["ounce", "oz"], ["ounces", "oz"], ["oz", "oz"],
  ["pound", "lb"], ["pounds", "lb"], ["lb", "lb"], ["lbs", "lb"],
  ["fluid ounce", "fl oz"], ["fluid ounces", "fl oz"], ["fl ounce", "fl oz"], ["fl ounces", "fl oz"], ["fl oz", "fl oz"],
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

function quantity(text) {
  const value = plain(text).replace(/\b(12ct|18ct|24ct|6ct|8ct|4ct)\b/g, (match) => match.replace("ct", " ct"));
  const multipack = value.match(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (multipack) return normalizeQuantity(Number(multipack[2]) * Number(multipack[1]), multipack[3]);

  const count = value.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
  if (count) return { dimension: "count", amount: Number(count[1]), display: `${count[1]} ct` };

  const match = value.match(/\b(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (!match) return null;
  const packSuffix = value.slice(match.index + match[0].length);
  const packMatch = packSuffix.match(/\b(?:(\d+)\s*pack|pack\s+of\s+(\d+))\b/);
  const multiplier = Number(packMatch?.[1] ?? packMatch?.[2] ?? 1);
  return normalizeQuantity(Number(match[1]) * multiplier, match[2]);
}

function normalizeQuantity(amount, rawUnit) {
  const unit = unitAliases.get(rawUnit.replace(/\s+/g, " ")) ?? rawUnit;
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

const stopWords = new Set([
  "a", "an", "and", "the", "with", "made", "from", "for", "of", "in", "by",
  "natural", "naturals",
  "frozen", "microwave", "meal", "meals", "food", "foods", "product", "products",
  "flavor", "flavored", "style", "premium", "ready", "serve",
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

function tokenScore(leftText, rightText) {
  const left = new Set(tokens(leftText));
  const right = new Set(tokens(rightText));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  const containment = shared / Math.min(left.size, right.size);
  const jaccard = shared / new Set([...left, ...right]).size;
  return 0.7 * containment + 0.3 * jaccard;
}

function brandAgrees(instacartName, amazonBrand) {
  const brandTokens = tokens(amazonBrand);
  const nameTokens = new Set(tokens(instacartName));
  if (!brandTokens.length) return false;
  if (brandTokens.every((token) => nameTokens.has(token))) return true;
  return brandTokens.length === 1 && nameTokens.has(brandTokens[0]);
}

const allMatches = [];
const queryByKey = new Map(wholeFoods.queries.map((query) => [queryKey(query.query), query]));
for (const item of allInstacart) {
  const looseCandidates = wholeFoods.records.filter((candidate) => {
    const left = {
      name: item.name,
      size: item.size,
      category: item.category,
      priceBasis: item.priceBasis,
      productUrl: item.productUrl,
      qualifierText: item.qualifierText,
    };
    const right = { ...candidate, category: candidate.category || item.category };
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
  const itemQuantity = quantity(item.size || item.name);
  if (!itemQuantity) continue;
  const expectedQuery = `${item.name} ${item.size || ""}`.trim();
  const exactQuery = queryByKey.get(queryKey(expectedQuery));
  const exactAsins = new Set(exactQuery?.asins ?? []);
  const preferredRecords = exactAsins.size
    ? wholeFoods.records.filter((candidate) => exactAsins.has(candidate.asin))
    : wholeFoods.records;
  let candidates = preferredRecords
    .map((candidate) => {
      const candidateQuantity = quantity(candidate.title);
      if (!quantitiesAgree(itemQuantity, candidateQuantity)) return null;
      if (!brandAgrees(item.name, candidate.brand)) return null;
      if (!crossSourceQualifiersCompatible(productQualifierEvidence(item), productQualifierEvidence(candidate))) return null;
      if (!numericProductVariantsCompatible(item.name, candidate.title)) return null;
      const score = tokenScore(item.name, candidate.title);
      return { candidate, candidateQuantity, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));
  if (!candidates.length && exactAsins.size) {
    candidates = wholeFoods.records
      .map((candidate) => {
        const candidateQuantity = quantity(candidate.title);
        if (!quantitiesAgree(itemQuantity, candidateQuantity)) return null;
        if (!brandAgrees(item.name, candidate.brand)) return null;
        if (!crossSourceQualifiersCompatible(productQualifierEvidence(item), productQualifierEvidence(candidate))) return null;
        if (!numericProductVariantsCompatible(item.name, candidate.title)) return null;
        const score = tokenScore(item.name, candidate.title);
        return { candidate, candidateQuantity, score };
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
    matchMethod: exactAsins.has(best.candidate.asin)
      ? "exact_query_brand_name_size"
      : "normalized_brand_name_size",
    matchScore: Number(best.score.toFixed(4)),
    matchMargin: Number(margin.toFixed(4)),
    sizeEvidence: `${itemQuantity.display} = ${best.candidateQuantity.display}`,
  };
  if (best.score >= 0.72 && (margin >= 0.08 || best.score >= 0.9)) allMatches.push(result);
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
  methodology: "Fully automatic conservative crosswalk requiring normalized brand and product agreement, equivalent package quantity and numeric variants, and agreement on protected product claims. Loose produce may match by exact normalized produce name, organic/variety wording, and selling basis. Loose meat and seafood may match only by exact normalized raw cut, explicitly captured per-pound basis, and agreement on organic, grass-fed, pasture-raised, free-range, air-chilled, wild/farmed, bone, skin, frozen, lean-percentage, grade, Angus, heritage, antibiotic, natural, rib-meat, value-pack, and retained-water claims. Poultry additionally requires product-detail qualifier evidence on both sides. Unmatched or ambiguous candidates are excluded automatically.",
  counts: {
    instacartAllFour: allFour.length,
    wholeFoodsCaptured: wholeFoods.records.length,
    accepted: matches.length,
    acceptedAnyStoreCount: uniqueMatches.length,
    acceptedByStoreCount: Object.fromEntries([1, 2, 3, 4].map((count) => [count, uniqueMatches.filter((match) => match.storeCount === count).length])),
  },
  matches: matches.sort((a, b) => a.instacartName.localeCompare(b.instacartName)),
  allMatches: uniqueMatches.sort((a, b) => b.storeCount - a.storeCount || a.instacartName.localeCompare(b.instacartName)),
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
