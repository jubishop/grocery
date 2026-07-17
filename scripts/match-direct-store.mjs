import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
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

const [instacart, direct, aliases] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(config.directPath, "utf8").then(JSON.parse),
  readFile(aliasesPath, "utf8").then(JSON.parse),
]);

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

function normalizeQuantity(amount, rawUnit) {
  const unit = unitAliases.get(rawUnit.replace(/\s+/g, " ")) ?? rawUnit;
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
  const slashPack = value.match(/\b(\d+)\s*(?:pack|pk)\s*(?:\/|x|×|-)\s*(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (slashPack) return normalizeQuantity(Number(slashPack[2]) * Number(slashPack[1]), slashPack[3]);
  const hyphenPack = value.match(/\b(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (hyphenPack) return normalizeQuantity(Number(hyphenPack[2]) * Number(hyphenPack[1]), hyphenPack[3]);
  const multipack = value.match(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (multipack) return normalizeQuantity(Number(multipack[2]) * Number(multipack[1]), multipack[3]);
  const packOf = value.match(/\b(\d+)\s*(?:pack|pk)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/);
  if (packOf) return normalizeQuantity(Number(packOf[1]) * Number(packOf[2]), packOf[3]);
  const count = value.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
  if (count) return normalizeQuantity(Number(count[1]), "ct");
  const matches = [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|kilograms?|kg|grams?|g)\b/g)];
  const match = matches.at(-1);
  if (!match) return null;
  return normalizeQuantity(Number(match[1]), match[2]);
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

function tokenScore(leftText, rightText) {
  const left = new Set(tokens(leftText));
  const right = new Set(tokens(rightText));
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

function brandsCompatible(leftText, rightText, score) {
  const left = brandTokens(leftText);
  const right = brandTokens(rightText);
  const leftLead = left[0];
  const rightLead = right[0];
  if (!leftLead || !rightLead) return true;
  if (right.includes(leftLead) || left.includes(rightLead)) return true;
  // Very high name agreement also covers retailer titles that omit the brand
  // entirely, such as "Pinto Beans" for S&W Pinto Beans.
  return score >= 0.9;
}

function phraseState(text, phrases) {
  const normalized = ` ${queryKey(text)} `;
  const matches = phrases.filter((phrase) => normalized.includes(` ${phrase} `));
  return matches.length === 1 ? matches[0] : null;
}

function stateConflict(leftText, rightText, phrases, contextPattern = null) {
  const combined = `${queryKey(leftText)} ${queryKey(rightText)}`;
  if (contextPattern && !contextPattern.test(combined)) return false;
  const left = phraseState(leftText, phrases);
  const right = phraseState(rightText, phrases);
  return Boolean(left && right && left !== right);
}

function variantsCompatible(leftText, rightText) {
  const conflicts = [
    stateConflict(leftText, rightText, ["unsalted", "salted"]),
    stateConflict(leftText, rightText, ["unsweetened", "sweetened"]),
    stateConflict(leftText, rightText, ["decaf", "caffeinated"], /\b(coffee|tea)\b/),
    stateConflict(leftText, rightText, ["extra sharp", "sharp", "medium", "mild"], /\b(cheese|cheddar)\b/),
    stateConflict(leftText, rightText, ["creamy", "crunchy"], /\bpeanut butter\b/),
    stateConflict(leftText, rightText, ["tikka masala", "butter chicken"], /\b(indian|chicken|meal)\b/),
    stateConflict(leftText, rightText, ["chicken", "beef", "vegetable", "mushroom"], /\b(broth|stock)\b/),
    stateConflict(leftText, rightText, ["penne", "rotini", "spaghetti", "fettuccine", "linguine", "elbows", "shells"], /\b(pasta|noodle)\b/),
    stateConflict(leftText, rightText, ["dark chocolate", "milk chocolate", "white chocolate"], /\bchocolate\b/),
    stateConflict(leftText, rightText, ["strawberry", "blueberry", "vanilla", "peach", "plain"], /\byogurt\b/),
  ];
  return !conflicts.some(Boolean);
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
  .filter(([, group]) => group.storeIds.has(storeId))
  .map(([productId, group]) => {
    const storeRecord = group.records.find((record) => record.storeId === storeId);
    return {
      productId,
      sourceProductIds: [...group.sourceProductIds],
      storeIds: [...group.storeIds],
      storeCount: group.storeIds.size,
      name: storeRecord.name,
      size: storeRecord.size || "",
      instacartPrice: storeRecord.price,
      instacartUrl: storeRecord.productUrl,
      quantity: quantity(storeRecord.size || storeRecord.name),
    };
  });

const directWithQuantity = direct.records
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
const directById = new Map(directWithQuantity.map((record) => [record.id, record]));
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

const accepted = [];
const review = [];
const exactReview = [];
for (const item of storeItems) {
  if (!item.quantity) continue;
  const expectedQueryKey = queryKey(`${item.name} ${item.size}`.trim());
  const targetedResultIds = resultIdsByProduct.get(item.productId);
  const exactResultIds = targetedResultIds ?? resultIdsByQuery.get(expectedQueryKey);
  const exactQueryRecords = exactResultIds
    ? [...exactResultIds].map((id) => directById.get(id)).filter(Boolean)
    : directWithQuantity.filter((record) => queryKey(record.query) === expectedQueryKey);
  const candidatePool = exactQueryRecords.length ? exactQueryRecords : directWithQuantity;
  const candidates = candidatePool
    .filter((record) => quantitiesAgree(item.quantity, record.quantity))
    .map((record) => ({ record, score: tokenScore(item.name, record.title) }))
    .filter(({ record, score }) => (
      brandsCompatible(item.name, record.title, score)
      && variantsCompatible(item.name, record.title)
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
    priceDifference: Number((item.instacartPrice - best.record.price).toFixed(2)),
    instacartMarkupPercent: Number(((item.instacartPrice / best.record.price - 1) * 100).toFixed(1)),
  };
  const isAccepted = (
    exactQueryRecords.length
      ? best.score >= 0.6 && (margin >= 0.05 || best.score >= 0.85)
      : best.score >= 0.78 && (margin >= 0.1 || best.score >= 0.93)
  );
  if (isAccepted) accepted.push(result);
  else if (exactQueryRecords.length) exactReview.push({
    ...result,
    alternatives: candidates.slice(0, 4).map(({ record, score }) => ({
      directId: record.id,
      title: record.title,
      size: record.size,
      price: record.price,
      score: Number(score.toFixed(4)),
    })),
  });
  else if (best.score >= 0.62 && margin >= 0.04) review.push(result);
}

const uniqueAccepted = accepted
  .sort((a, b) => b.storeCount - a.storeCount || b.matchScore - a.matchScore || b.matchMargin - a.matchMargin)
  .filter((match, index, matches) => matches.findIndex((candidate) => candidate.directId === match.directId) === index)
  .sort((a, b) => a.instacartName.localeCompare(b.instacartName));

const acceptedKeys = new Set(uniqueAccepted.map((match) => `${match.productId}|${match.directId}`));
const remainingReview = review
  .filter((match) => !acceptedKeys.has(`${match.productId}|${match.directId}`))
  .sort((a, b) => b.storeCount - a.storeCount || b.matchScore - a.matchScore);

const priceDifferences = uniqueAccepted.map((match) => match.priceDifference).sort((a, b) => a - b);
const output = {
  generatedAt: new Date().toISOString(),
  storeId,
  source: config.source,
  methodology: `Conservative ${config.displayName} direct-catalog crosswalk requiring equivalent package quantity, strong normalized product-name agreement, and an unambiguous best candidate. Unmatched items are excluded from the current ${config.displayName} corpus rather than falling back to Instacart.`,
  counts: {
    instacartStoreProducts: storeItems.length,
    directProductsCaptured: direct.records.length,
    accepted: uniqueAccepted.length,
    review: remainingReview.length,
    exactReview: exactReview.length,
    acceptedByStoreCount: Object.fromEntries([1, 2, 3, 4].map((count) => [count, uniqueAccepted.filter((match) => match.storeCount === count).length])),
  },
  markupSummary: {
    comparedProducts: uniqueAccepted.length,
    instacartHigherCount: uniqueAccepted.filter((match) => match.priceDifference > 0).length,
    directHigherCount: uniqueAccepted.filter((match) => match.priceDifference < 0).length,
    samePriceCount: uniqueAccepted.filter((match) => match.priceDifference === 0).length,
    totalInstacart: Number(uniqueAccepted.reduce((sum, match) => sum + match.instacartPrice, 0).toFixed(2)),
    totalDirect: Number(uniqueAccepted.reduce((sum, match) => sum + match.directPrice, 0).toFixed(2)),
    medianDifference: priceDifferences[Math.floor(priceDifferences.length / 2)] ?? 0,
  },
  matches: uniqueAccepted,
  review: remainingReview,
  exactReview: exactReview.sort((a, b) => b.storeCount - a.storeCount || b.matchScore - a.matchScore),
};

await writeFile(config.outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ counts: output.counts, markupSummary: output.markupSummary }, null, 2));
