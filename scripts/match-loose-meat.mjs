import {
  crossSourceQualifiersCompatible,
  productQualifierEvidence,
  protectedQualifierClaims,
} from "./match-product-qualifiers.mjs";

const preparedPattern = /\b(?:bacon|breaded|burger|cooked|corned|deli|frank|grilled|hot dog|jerky|kabob|marinated|meatball|meatloaf|nugget|patty|roasted|sausage|seasoned|shredded|skewer|smoked|stuffed)\b/i;
const rawAnimalPattern = /\b(?:beef|bison|chicken|clam|cod|crab|duck|fish|goat|halibut|lamb|lobster|mahi|mussel|octopus|oyster|pork|salmon|scallop|shrimp|squid|steak|tilapia|trout|tuna|turkey|veal)\b/i;
const retailerBrandPatterns = [
  /\bsignature\s+select\s*[\/&]\s*farms\b/g,
  /\b365 by whole foods market\b/g,
  /\bwhole foods market\b/g,
  /\bmetropolitan market\b/g,
  /\bcoastal range organics?\b/g,
  /\bdraper valley farms\b/g,
  /\bsignature (?:select|farms)\b/g,
  /\bsimple truth\b/g,
  /\bo organics\b/g,
  /\bopen nature\b/g,
  /\bkroger\b/g,
  /\branger\b/g,
  /\broxy\b/g,
  /\bpcc\b/g,
];
const qualifierPatterns = [
  /\b\d{2}\s*(?:percent\s*)?lean\b/g,
  /\b\d{2}\s+\d{1,2}\b/g,
  /\b\d{1,2}\s*(?:percent\s*)?fat\b/g,
  /\b(?:all )?natural\b/g,
  /\borganics?\b/g,
  /\bgrass (?:fed|finished)\b/g,
  /\bpasture raised\b/g,
  /\bfree range\b/g,
  /\bair chilled\b/g,
  /\bwild caught\b/g,
  /\bfarm raised\b/g,
  /\bfarmed\b/g,
  /\bnever frozen\b/g,
  /\bpreviously frozen\b/g,
  /\bfrozen\b/g,
  /\bno antibiotics\b/g,
  /\bwithout antibiotics\b/g,
  /\bantibiotic free\b/g,
  /\b(?:usda )?(?:prime|choice|select)\b/g,
  /\bangus\b/g,
  /\b(?:heritage|heirloom)\b/g,
  /\bboneless\b/g,
  /\bbone in\b/g,
  /\bskinless\b/g,
  /\bskin on\b/g,
  /\bpacks?\b/g,
  /\bfresh\b/g,
];
const singularTokens = new Map([
  ["breasts", "breast"],
  ["chops", "chop"],
  ["drumsticks", "drumstick"],
  ["fillets", "fillet"],
  ["quarters", "quarter"],
  ["ribs", "rib"],
  ["steaks", "steak"],
  ["tenders", "tender"],
  ["thighs", "thigh"],
  ["wings", "wing"],
]);

function plain(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase();
}

export function looseMeatKey(record) {
  if (record?.comparisonEligible === false) return null;
  const title = String(record?.title ?? record?.name ?? "");
  if (!/\b(?:meat|seafood)\b/i.test(String(record?.category ?? ""))) return null;
  if (String(record?.priceBasis ?? "").toLowerCase() !== "per lb") return null;
  if (!rawAnimalPattern.test(title)) return null;
  if (preparedPattern.test(title)) return null;
  if (protectedQualifierClaims(title).plantBased) return null;

  let normalized = plain(title)
    .replace(/\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|ounces?|lb|lbs?|pounds?|g|kg)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ");
  for (const pattern of retailerBrandPatterns) normalized = normalized.replace(pattern, " ");
  for (const pattern of qualifierPatterns) normalized = normalized.replace(pattern, " ");
  normalized = normalized.replace(/\b(?:approximately|approx|estimated|avg|average)\b/g, " ");
  return normalized
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => singularTokens.get(token) ?? token)
    .join(" ") || null;
}

export function looseMeatMatches(left, right) {
  const leftKey = looseMeatKey(left);
  if (!leftKey || leftKey !== looseMeatKey(right)) return false;
  if (
    /\b(?:chicken|duck|turkey)\b/i.test(`${leftKey} ${looseMeatKey(right)}`)
    && (!String(left?.qualifierText ?? "").trim() || !String(right?.qualifierText ?? "").trim())
  ) return false;
  const leftEvidence = productQualifierEvidence(left);
  const rightEvidence = productQualifierEvidence(right);
  if (!crossSourceQualifiersCompatible(leftEvidence, rightEvidence)) return false;

  const leftClaims = protectedQualifierClaims(leftEvidence);
  const rightClaims = protectedQualifierClaims(rightEvidence);
  return leftClaims.organic === rightClaims.organic
    && leftClaims.grassFed === rightClaims.grassFed;
}
