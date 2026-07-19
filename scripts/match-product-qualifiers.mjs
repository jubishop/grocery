function qualifierText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function protectedQualifierClaims(value) {
  const normalized = qualifierText(value);
  const productLevelOrganicText = normalized
    .replace(/\bmade\s+with\s+organic\b/g, "made with")
    .replace(/\b\d+(?:\.\d+)?\s*(?:percent\s*)?organic\s+ingredients?\b/g, " ")
    .replace(/\borganic\s+ingredients?\b/g, " ");
  const leanMatch = normalized.match(/\b(\d{2})\s*(?:percent\s*)?lean\b|\b(\d{2})\s+\d{1,2}\b/);
  const gradeMatch = normalized.match(/\busda\s*(prime|choice|select)\b/)
    ?? (/\bbeef\b/.test(normalized) ? normalized.match(/\b(prime|choice)\b/) : null);
  const frozenState = /\bnever frozen\b/.test(normalized)
    ? "never frozen"
    : /\bpreviously frozen\b/.test(normalized)
      ? "previously frozen"
      : /\bfrozen\b/.test(normalized)
        ? "frozen"
        : null;
  return {
    organic: /\borganics?\b/.test(productLevelOrganicText) && !/\bnon organic\b/.test(productLevelOrganicText),
    glutenFree: /\bgluten\s*free\b/.test(normalized),
    dairyFree: /\b(?:dairy\s*free|non\s*dairy)\b/.test(normalized),
    vegan: /\bvegan\b/.test(normalized),
    sodiumState: /\b(?:no\s+salt\s+added|unsalted)\b/.test(normalized)
      ? "no salt added"
      : /\b(?:low|light\s+in)\s+sodium\b/.test(normalized)
        ? "low sodium"
        : /\breduced\s+sodium\b/.test(normalized)
          ? "reduced sodium"
          : null,
    sugarState: /\bno\s+sugar\s+added\b/.test(normalized)
      ? "no sugar added"
      : /\bsugar\s*free\b/.test(normalized)
        ? "sugar free"
        : /\breduced\s+sugar\b/.test(normalized)
          ? "reduced sugar"
          : null,
    nonGmo: /\b(?:non\s*gmo|gmo\s*free)\b/.test(normalized),
    plantBased: /\bplant\s*based\b/.test(normalized),
    grassFed: /\bgrass\s*(?:fed|finished)\b/.test(normalized),
    grainFed: /\bgrain\s*(?:fed|finished)\b/.test(normalized),
    pastureRaised: /\bpasture\s*raised\b/.test(normalized),
    freeRange: /\bfree\s*range\b/.test(normalized),
    vegetarianFed: /\bvegetarian\s*(?:fed|diet)\b/.test(normalized),
    airChilled: /\bair\s*chilled\b|\bairchilled\b/.test(normalized),
    wildCaught: /\bwild\b/.test(normalized),
    farmRaised: /\bfarm\s*raised\b|\bfarmed\b/.test(normalized),
    boneState: /\bboneless\b/.test(normalized)
      ? "boneless"
      : /\bbone\s*in\b/.test(normalized)
        ? "bone in"
        : null,
    skinState: /\bskinless\b/.test(normalized)
      ? "skinless"
      : /\bskin\s*on\b/.test(normalized)
        ? "skin on"
        : null,
    frozenState,
    leanPercent: leanMatch?.[1] ?? leanMatch?.[2] ?? null,
    grade: gradeMatch?.[1] ?? null,
    angus: /\bangus\b/.test(normalized),
    wagyu: /\bwagyu\b/.test(normalized),
    heritage: /\b(?:heritage|heirloom)\b/.test(normalized),
    noAntibiotics: /\b(?:no|never)\s*antibiotics\b|\b(?:raised\s+)?without(?:\s+(?:any|the\s+use\s+of))?\s+antibiotics\b|\bantibiotic\s*free\b/.test(normalized),
    humane: /\b(?:certified\s*)?humane\b/.test(normalized),
    halal: /\bhalal\b/.test(normalized),
    kosher: /\bkosher\b/.test(normalized),
    natural: /\b(?:all\s*)?natural\b/.test(normalized),
    ribMeat: /\brib\s*meat\b/.test(normalized),
    valuePack: /\bvalue\s*pack\b/.test(normalized),
    bulk: /\bbulk\b/.test(normalized),
    waterState: /\bno\s+(?:added\s+water|retained\s+water|water\s+added)\b/.test(normalized)
      ? "no water added"
      : /\b(?:retained|added)\s*water\b/.test(normalized)
        ? "water added"
        : null,
    smoked: /\bsmoked\b/.test(normalized),
    marinated: /\bmarinated\b/.test(normalized),
    seasoned: /\bseasoned\b/.test(normalized),
    uncured: /\buncured\b/.test(normalized),
  };
}

function qualifiersCompatible(left, right, claims) {
  const leftClaims = protectedQualifierClaims(left);
  const rightClaims = protectedQualifierClaims(right);
  return claims.every((claim) => leftClaims[claim] === rightClaims[claim]);
}

const commonClaims = [
  "organic",
  "glutenFree",
  "dairyFree",
  "sodiumState",
  "sugarState",
];
const meatClaims = [
  "nonGmo",
  "plantBased",
  "grassFed",
  "grainFed",
  "pastureRaised",
  "freeRange",
  "vegetarianFed",
  "airChilled",
  "wildCaught",
  "farmRaised",
  "boneState",
  "skinState",
  "frozenState",
  "leanPercent",
  "grade",
  "angus",
  "wagyu",
  "heritage",
  "noAntibiotics",
  "humane",
  "halal",
  "kosher",
  "natural",
  "ribMeat",
  "valuePack",
  "bulk",
  "waterState",
  "smoked",
  "marinated",
  "seasoned",
  "uncured",
];
const meatOrSeafoodPattern = /\b(?:beef|bison|chicken|clam|cod|crab|duck|fish|goat|halibut|ham|lamb|lobster|mahi|meat|mussel|octopus|oyster|pork|salmon|scallop|seafood|shrimp|squid|steak|tilapia|trout|tuna|turkey|veal)\b/i;

export function productQualifiersCompatible(left, right) {
  const claims = [...commonClaims, "nonGmo", "plantBased"];
  if (meatOrSeafoodPattern.test(`${left} ${right}`)) claims.push(...meatClaims);
  return qualifiersCompatible(left, right, claims);
}

export function crossSourceQualifiersCompatible(left, right) {
  if (!meatOrSeafoodPattern.test(`${left} ${right}`)) return qualifiersCompatible(left, right, commonClaims);
  return qualifiersCompatible(left, right, [...commonClaims, ...meatClaims]);
}

export function productQualifierEvidence(record) {
  if (record && typeof record === "object") {
    return `${record.title ?? record.name ?? ""} ${record.qualifierText ?? ""}`.trim();
  }
  return String(record ?? "");
}

export function numericProductVariantsCompatible(left, right) {
  const numbers = (value) => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b100\s*(?:%|percent)\b/g, " ")
    .replace(/\bno\.?\s*1\s+brand\b/g, " ")
    .replace(/\b1\s+(?:bag|bottle|box|can|carton|pouch|unit)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:fl\.?\s*oz\.?|fz|fluid\s*ounces?|ounces?|oz|pounds?|lbs?|lb|milliliters?|ml|liters?|litres?|l|gallons?|gal|kilograms?|kg|grams?|g|count|ct|each|ea|pack|pk)\b/g, " ")
    .replace(/\b(?:pack|case)\s+of\s+\d+\b/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .match(/\d+(?:\.\d+)?/g) ?? [];
  const leftNumbers = numbers(left);
  const rightNumbers = numbers(right);
  return leftNumbers.length === rightNumbers.length
    && leftNumbers.every((number, index) => number === rightNumbers[index]);
}
