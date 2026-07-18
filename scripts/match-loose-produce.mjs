import { crossSourceQualifiersCompatible } from "./match-product-qualifiers.mjs";

const fixedWeightOrVolumePattern = /\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|ounces?|lb|lbs?|pounds?|g|kg|ml|l|pt|pint|qt|quart)\b/i;
const multiCountPattern = /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*(?:ct|count|pack|pk)\b/i;
const preparedProducePattern = /\b(?:bag|bagged|bowl|chopped|clamshell|diced|florets|halves|juice|kit|mix|peeled|prepacked|sliced|tray|wedges)\b/i;
const singularProduceTokens = new Map([
  ["apples", "apple"],
  ["avocados", "avocado"],
  ["bananas", "banana"],
  ["cucumbers", "cucumber"],
  ["lemons", "lemon"],
  ["limes", "lime"],
  ["onions", "onion"],
  ["oranges", "orange"],
  ["peppers", "pepper"],
  ["potatoes", "potato"],
  ["shallots", "shallot"],
  ["tomatoes", "tomato"],
]);
const retailerBrandPatterns = [
  /\bsignature\s+select\s*[\/&]\s*farms\b/g,
  /\b365 by whole foods market\b/g,
  /\bwhole foods market\b/g,
  /\bmetropolitan market\b/g,
  /\bsignature (?:select|farms)\b/g,
  /\bsimple truth\b/g,
  /\bo organics\b/g,
  /\bkroger\b/g,
  /\bpcc\b/g,
];

function plain(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase();
}

export function looseProduceKey(record) {
  const title = String(record?.title ?? record?.name ?? "");
  const category = String(record?.category ?? "");
  if (!/\bproduce\b/i.test(category)) return null;
  if (fixedWeightOrVolumePattern.test(`${title} ${record?.size ?? ""}`)) return null;
  if (multiCountPattern.test(`${title} ${record?.size ?? ""}`)) return null;
  if (preparedProducePattern.test(title)) return null;

  let normalized = plain(title);
  for (const pattern of retailerBrandPatterns) normalized = normalized.replace(pattern, " ");
  const key = normalized
    .replace(/\b(?:fresh|produce|ripe|whole)\b/g, " ")
    .replace(/\b(?:1|one)\s*(?:each|ea|single)\b/g, " ")
    .replace(/\b1\s*(?:ct|count)\b/g, " ")
    .replace(/\s*[-–,]\s*(?:each|ea|single)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => singularProduceTokens.get(token) ?? token)
    .join(" ");
  return key || null;
}

export function looseProduceBasis(record) {
  const evidence = `${record?.priceBasis ?? ""} ${record?.size ?? ""} ${record?.title ?? record?.name ?? ""} ${record?.productUrl ?? ""}`;
  if (/\bper[- ]lb\b|\/\s*lb\b/i.test(evidence)) return "per lb";
  if (/\b(?:each|ea|single)\b/i.test(evidence)) return "per item";
  return record?.priceBasis === "per lb" ? "per lb" : "per item";
}

export function looseProduceMatches(left, right) {
  const leftKey = looseProduceKey(left);
  return Boolean(
    leftKey
    && leftKey === looseProduceKey(right)
    && looseProduceBasis(left) === looseProduceBasis(right)
    && crossSourceQualifiersCompatible(
      left?.title ?? left?.name ?? "",
      right?.title ?? right?.name ?? "",
    )
  );
}
