import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
const wholeFoodsPath = path.join(root, "data/whole-foods-capture-checkpoint.json");
const outputPath = path.join(root, "data/whole-foods-matches.json");
const overridesPath = path.join(root, "data/whole-foods-match-overrides.json");

const [instacart, wholeFoods, overrides] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(wholeFoodsPath, "utf8").then(JSON.parse),
  readFile(overridesPath, "utf8").then(JSON.parse),
]);

const storeIds = ["pcc", "metro", "safeway", "qfc"];
const groups = new Map();
for (const record of instacart.records) {
  const byStore = groups.get(record.id) ?? new Map();
  byStore.set(record.storeId, record);
  groups.set(record.id, byStore);
}

const allInstacart = [...groups.entries()]
  .map(([id, byStore]) => {
    const records = [...byStore.values()];
    const representative = records.sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0];
    return {
      id,
      name: representative.name,
      size: representative.size || "",
      category: representative.category || "Other Groceries",
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
  "organic", "natural", "naturals", "non", "gmo", "gluten", "free", "plant", "based",
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
const allReview = [];
for (const item of allInstacart) {
  const itemQuantity = quantity(item.size || item.name);
  if (!itemQuantity) continue;
  const candidates = wholeFoods.records
    .map((candidate) => {
      const candidateQuantity = quantity(candidate.title);
      if (!quantitiesAgree(itemQuantity, candidateQuantity)) return null;
      if (!brandAgrees(item.name, candidate.brand)) return null;
      const score = tokenScore(item.name, candidate.title);
      return { candidate, candidateQuantity, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));

  const best = candidates[0];
  const next = candidates[1];
  if (!best) continue;
  const margin = best.score - (next?.score ?? 0);
  const result = {
    productId: item.id,
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
    matchMethod: "normalized_brand_name_size",
    matchScore: Number(best.score.toFixed(4)),
    matchMargin: Number(margin.toFixed(4)),
    sizeEvidence: `${itemQuantity.display} = ${best.candidateQuantity.display}`,
  };
  if (best.score >= 0.72 && (margin >= 0.08 || best.score >= 0.9)) allMatches.push(result);
  else if (best.score >= 0.58) allReview.push(result);
}

const reviewedByKey = new Map([...allMatches, ...allReview].map((match) => [`${match.productId}|${match.asin}`, match]));
for (const override of overrides.accepted) {
  const key = `${override.productId}|${override.asin}`;
  const reviewed = reviewedByKey.get(key);
  if (!reviewed || allMatches.some((match) => `${match.productId}|${match.asin}` === key)) continue;
  allMatches.push({ ...reviewed, matchMethod: "human_reviewed_brand_variant_size", manualReviewNote: override.note });
}
const acceptedKeys = new Set(allMatches.map((match) => `${match.productId}|${match.asin}`));
const remainingReview = allReview.filter((match) => !acceptedKeys.has(`${match.productId}|${match.asin}`));
const matches = allMatches.filter((match) => match.storeCount === 4);
const review = remainingReview.filter((match) => match.storeCount === 4);

const output = {
  generatedAt: new Date().toISOString(),
  methodology: "Conservative automatic crosswalk: matching normalized brand, product/flavor tokens, and equivalent package quantity; ambiguous candidates are excluded.",
  counts: {
    instacartAllFour: allFour.length,
    wholeFoodsCaptured: wholeFoods.records.length,
    accepted: matches.length,
    review: review.length,
    acceptedAnyStoreCount: allMatches.length,
    acceptedByStoreCount: Object.fromEntries([1, 2, 3, 4].map((count) => [count, allMatches.filter((match) => match.storeCount === count).length])),
  },
  matches: matches.sort((a, b) => a.instacartName.localeCompare(b.instacartName)),
  review: review.sort((a, b) => b.matchScore - a.matchScore || a.instacartName.localeCompare(b.instacartName)),
  allMatches: allMatches.sort((a, b) => b.storeCount - a.storeCount || a.instacartName.localeCompare(b.instacartName)),
  allReview: remainingReview.sort((a, b) => b.storeCount - a.storeCount || b.matchScore - a.matchScore || a.instacartName.localeCompare(b.instacartName)),
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
