import {
  crossSourceQualifiersCompatible,
  protectedQualifierClaims,
} from "./match-product-qualifiers.mjs";
import { looseMeatMatches } from "./match-loose-meat.mjs";

const PRODUCE_CATEGORIES = /^(?:fresh fruits & veggies|fruits|produce|veggies)$/i;
const RAW_MEAT_CATEGORIES = /^(?:beef, pork & lamb|chicken & turkey|fish & seafood|meat & seafood)$/i;
const PREPARED_PRODUCE = /&|\b(?:blend|bowl|chopped|chunks?|collection|crunch|cut|diced|duo|hash|juice|kit|medley|mirepoix|mix|peeled|pitted|ready|salad|shelled|shredded|sliced|slaw|soup|steamed|sticks?|stir fry|trio|with)\b/i;
const PREPARED_MEAT = /\b(?:al pastor|bacon|balsamic|bbq|breaded|burger|cooked|corned|deli|grill pack|grilled|herbed|jerky|kabob|lemon|marinated|meatball|meatloaf|patties|pesto|rosemary|sausage|savory|seasoned|shawarma|smoked|spatchcocked|stuffed|sun[- ]dried|teriyaki)\b/i;
const SEAFOOD_OR_POULTRY = /\b(?:chicken|duck|fish|salmon|seafood|shrimp|turkey)\b/i;
const EXPLICIT_SEAFOOD_ORIGIN = /\b(?:farm(?:ed| raised)|wild(?: caught)?)\b/i;
const RETAILER_BRANDS = [
  /\b365 by whole foods market\b/g,
  /\bwhole foods market\b/g,
  /\bmetropolitan market\b/g,
  /\bsignature (?:select|farms)\b/g,
  /\bsimple truth\b/g,
  /\bo organics\b/g,
  /\bopen nature\b/g,
  /\bkroger\b/g,
  /\blucerne\b/g,
  /\bpcc\b/g,
  /\btrader joes\b/g,
];
const PRODUCE_SINGULARS = new Map([
  ["apples", "apple"],
  ["avocados", "avocado"],
  ["bananas", "banana"],
  ["berries", "berry"],
  ["cucumbers", "cucumber"],
  ["lemons", "lemon"],
  ["limes", "lime"],
  ["mushrooms", "mushroom"],
  ["onions", "onion"],
  ["oranges", "orange"],
  ["peppers", "pepper"],
  ["potatoes", "potato"],
  ["shallots", "shallot"],
  ["strawberries", "strawberry"],
  ["tomatoes", "tomato"],
]);

function plain(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9.%/]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function packageQuantity(value) {
  const normalized = plain(value);
  const dozen = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:doz|dozen)\b/);
  if (dozen) return { dimension: "count", amount: Number(dozen[1]) * 12 };
  const count = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:ct|count|each|ea)\b/);
  if (count) return { dimension: "count", amount: Number(count[1]) };
  const multipack = normalized.match(/\b(\d+)\s*[x/]\s*(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|lb|lbs|g|kg|ml|l)\b/);
  if (multipack) {
    const [, packCount, amount, unit] = multipack;
    return packageQuantity(`${Number(packCount) * Number(amount)} ${unit}`);
  }
  const match = normalized.match(/\b(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|lb|lbs|g|kg|ml|l)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].replace(/\s+/g, " ");
  if (unit === "lb" || unit === "lbs") return { dimension: "mass", amount: amount * 16 };
  if (unit === "oz") return { dimension: "mass", amount };
  if (unit === "g") return { dimension: "mass", amount: amount / 28.349523125 };
  if (unit === "kg") return { dimension: "mass", amount: (amount * 1000) / 28.349523125 };
  if (unit === "fl oz") return { dimension: "volume", amount };
  if (unit === "ml") return { dimension: "volume", amount: amount / 29.5735295625 };
  if (unit === "l") return { dimension: "volume", amount: (amount * 1000) / 29.5735295625 };
  return null;
}

export function packageQuantitiesAgree(left, right) {
  if (!left || !right || left.dimension !== right.dimension) return false;
  const tolerance = left.dimension === "count"
    ? 0
    : Math.max(0.08, Math.min(left.amount, right.amount) * 0.025);
  return Math.abs(left.amount - right.amount) <= tolerance;
}

function productText(record) {
  return `${record?.title ?? record?.name ?? ""} ${record?.size ?? ""}`.trim();
}

function produceKey(record) {
  let normalized = plain(record?.title ?? record?.name ?? "");
  for (const pattern of RETAILER_BRANDS) normalized = normalized.replace(pattern, " ");
  return normalized
    .replace(/\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|lbs|pounds?|g|kg|ml|l|ct|count|each|ea)\b/g, " ")
    .replace(/\b(?:bag|bagged|clamshell|fresh|package|packaged|produce|ripe|whole)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => PRODUCE_SINGULARS.get(token) ?? token)
    .join(" ");
}

function descriptor(value, choices) {
  const normalized = ` ${plain(value)} `;
  return choices.filter((choice) => normalized.includes(` ${choice} `)).join("+");
}

function commoditySignature(record, family) {
  const text = plain(record?.title ?? record?.name ?? "");
  const claims = protectedQualifierClaims(`${text} ${record?.qualifierText ?? ""}`);
  const organic = claims.organic ? "organic" : "conventional";
  const gluten = claims.glutenFree ? "gluten-free" : "standard-gluten";
  const nonGmo = claims.nonGmo ? "non-gmo" : "not-labeled-non-gmo";
  const fairTrade = /\bfair trade\b/.test(text) ? "fair-trade" : "not-labeled-fair-trade";
  switch (family) {
    case "produce":
      return `${organic}|${produceKey(record)}`;
    case "eggs":
      return [
        organic,
        claims.pastureRaised ? "pasture-raised" : "not-pasture-raised",
        claims.freeRange ? "free-range" : "not-free-range",
        descriptor(text, ["jumbo", "extra large", "large", "medium", "small"]),
        descriptor(text, ["brown", "white"]),
        "eggs",
      ].join("|");
    case "butter":
      return [
        organic,
        descriptor(text, ["cultured"]),
        descriptor(text, ["unsalted", "salted"]),
        "butter",
      ].join("|");
    case "milk":
      return [
        organic,
        descriptor(text, ["coconut", "lactose free", "a2/a2", "whole", "reduced fat", "2%", "low fat", "1%", "nonfat", "skim", "chocolate", "unsweetened"]),
        "milk",
      ].join("|");
    case "flour":
      {
        const kind = descriptor(text, ["all purpose", "bread", "whole wheat", "cake", "almond", "coconut"]);
        if (!kind) return "";
        return [
        organic,
        gluten,
        nonGmo,
        kind,
        descriptor(text, ["unbleached", "bleached"]),
        descriptor(text, ["enriched"]),
        "flour",
        ].join("|");
      }
    case "sugar":
      {
        const kind = descriptor(text, ["powdered", "brown", "turbinado", "raw", "cane", "granulated"]);
        if (!kind) return "";
        return [
        organic,
        fairTrade,
        kind,
        descriptor(text, ["dark", "light"]),
        "sugar",
        ].join("|");
      }
    case "beans":
      {
        const kind = descriptor(text, ["black", "pinto", "kidney", "garbanzo", "chickpea", "cannellini", "navy", "great northern"]);
        if (!kind) return "";
        return [
        organic,
        kind,
        descriptor(text, ["low sodium", "no salt added"]),
        "beans",
        ].join("|");
      }
    case "rice":
      {
        const kind = descriptor(text, ["basmati", "jasmine", "brown", "white", "sushi", "arborio", "wild"]);
        if (!kind) return "";
        return [
        organic,
        kind,
        descriptor(text, ["india", "indian", "thailand", "thai"]),
        "rice",
        ].join("|");
      }
    case "oats":
      return [
        organic,
        gluten,
        descriptor(text, ["steel cut", "rolled", "quick", "old fashioned"]),
        descriptor(text, ["extra thick"]),
        "oats",
      ].join("|");
    case "pasta":
      {
        const shape = descriptor(text, [
          "spaghetti", "penne", "cavatappi", "fusilli", "rotini", "linguine",
          "fettuccine", "elbows", "shells", "orzo", "pappardelle", "campanelle",
        ]);
        if (!shape) return "";
        return [
        organic,
        gluten,
        shape,
        descriptor(text, ["corti bucati", "whole wheat", "brown rice", "quinoa", "chickpea", "lentil", "semolina"]),
        "pasta",
        ].join("|");
      }
    case "oil-vinegar":
      return [
        organic,
        descriptor(text, ["extra virgin", "virgin"]),
        descriptor(text, ["olive", "avocado", "coconut", "sesame", "canola", "rice", "apple cider", "red wine", "balsamic"]),
        descriptor(text, ["spanish", "italian", "italy", "sicilian", "global blend"]),
        descriptor(text, ["raw", "robust", "smooth", "mild", "premium", "gourmet"]),
        /\bvinegar\b/.test(text) ? "vinegar" : "oil",
      ].join("|");
    case "salt":
      return [
        descriptor(text, ["iodized", "kosher", "sea"]),
        descriptor(text, ["fine", "coarse"]),
        "salt",
      ].join("|");
    case "cheese":
      {
        const kind = descriptor(text, ["cheddar", "mozzarella"]);
        if (!kind) return "";
        return [
        organic,
        kind,
        descriptor(text, ["extra sharp", "sharp", "medium", "mild"]),
        descriptor(text, ["whole milk", "part skim", "low moisture", "fresh"]),
        descriptor(text, ["shredded", "sliced", "log", "ball"]),
        descriptor(text, ["new zealand"]),
        claims.natural ? "natural" : "not-labeled-natural",
        "cheese",
        ].join("|");
      }
    default:
      return "";
  }
}

export function traderJoesCommodityFamily(record) {
  const title = String(record?.title ?? record?.name ?? "");
  const normalized = plain(title);
  const category = String(record?.category ?? "");
  if (PRODUCE_CATEGORIES.test(category)) {
    if (PREPARED_PRODUCE.test(title)) return null;
    return "produce";
  }
  if (RAW_MEAT_CATEGORIES.test(category)) {
    if (PREPARED_MEAT.test(title)) return null;
    if (!/\b(?:beef|bison|chicken|cod|halibut|lamb|pork|salmon|shrimp|steak|trout|tuna|turkey)\b/i.test(title)) return null;
    if (String(record?.priceBasis ?? "").toLowerCase() !== "per lb") return null;
    return "raw-meat";
  }
  if (/\beggs?$/.test(normalized)) return "eggs";
  if ((/\bbutter\b$/.test(normalized) || /^butter quarters\b/.test(normalized))
      && !/\b(?:almond|cashew|cookie|nut|oat|peanut|plant based|spread|with|garlic|herb)\b/.test(normalized)) return "butter";
  if (/\bmilk\b/.test(normalized)
      && (/^milk & cream$/i.test(category) || /\bmilk(?: made with .+)?$/.test(normalized))
      && !/\b(?:creamer|non dairy|oat|almond|thins|whipped|flavored|yogurt)\b/.test(normalized)) return "milk";
  if (/\bflour\b/.test(normalized) && !/\b(?:mix|tortilla)\b/.test(normalized)) return "flour";
  if (/\bsugar\b/.test(normalized)
      && (/^for baking & cooking$/i.test(category) || /\bsugar$/.test(normalized))
      && !/\b(?:cookie|candy|chocolate|creamer|flavor|gummy|sauce|syrup)\b/.test(normalized)) return "sugar";
  if (/\b(?:black|pinto|kidney|garbanzo|chickpea|cannellini|navy|great northern)\s+beans?\b/.test(normalized)
      && !/\b(?:burrito|chili|chips?|green bean|jelly|refried|seasoned|soup|taquitos?|tortilla|vanilla)\b/.test(normalized)) return "beans";
  if (/\brice\b/.test(normalized) && !/\b(?:bars?|fried|pudding|vinegar|cake|cracker|crisp|nugget|pasta)\b/.test(normalized)) return "rice";
  if (/\b(?:oats|oatmeal)\b/.test(normalized)
      && !/\b(?:ancient grains|bar|bread|cookie|milk|beverage|creamer|overnight|seeds|with)\b/.test(normalized)) return "oats";
  if (/\bpasta\b/.test(normalized) && !/\b(?:bowl|canned|hearts of palm|sauce|salad|meal|prepared|lemon)\b/.test(normalized)) return "pasta";
  if (/\b(?:oil|vinegar)\b/.test(normalized) && !/\b(?:spray|infused|flavored|dressing|with)\b/.test(normalized)) return "oil-vinegar";
  if (/^(?:(?:fine|coarse)\s+)?(?:(?:iodized|kosher|sea)\s+)?salt$/.test(normalized)) return "salt";
  if (/\b(?:cheddar|mozzarella)\b/.test(normalized)
      && /\bcheese\b/.test(normalized)
      && !/\b(?:antipasto|bacon|breaded|dairy free|macaroni|marinated|melange|prosciutto|quiche|sandwich|unexpected|blend|pizza|popcorn|snackers?|snack|sticks|with|truffle|jalapeno|garlic|herb)\b/.test(normalized)) return "cheese";
  return null;
}

export function traderJoesCommodityMatch(left, right) {
  const family = traderJoesCommodityFamily(left);
  if (!family) return { matched: false, family: null, reason: "not_plain_commodity" };
  const rightFamily = traderJoesCommodityFamily(right);
  if (rightFamily !== family) return { matched: false, family, reason: "commodity_family_mismatch" };

  if (family === "raw-meat") {
    const evidence = `${left?.title ?? ""} ${left?.qualifierText ?? ""}`;
    if (SEAFOOD_OR_POULTRY.test(left?.title ?? "")
        && !String(left?.qualifierText ?? "").trim()
        && !EXPLICIT_SEAFOOD_ORIGIN.test(evidence)) {
      return { matched: false, family, reason: "missing_animal_qualifier_evidence" };
    }
    const matched = looseMeatMatches(
      { ...left, category: "Meat & Seafood" },
      { ...right, category: "Meat & Seafood" },
    );
    return {
      matched,
      family,
      reason: matched ? "" : "raw_cut_or_claim_mismatch",
      signature: matched ? "exact raw cut, protected claims, and per lb basis" : "",
    };
  }

  if (!crossSourceQualifiersCompatible(
    `${left?.title ?? ""} ${left?.qualifierText ?? ""}`,
    `${right?.title ?? right?.name ?? ""} ${right?.qualifierText ?? ""}`,
  )) return { matched: false, family, reason: "protected_claim_mismatch" };

  const leftQuantity = packageQuantity(productText(left));
  const rightQuantity = packageQuantity(productText(right));
  if (!packageQuantitiesAgree(leftQuantity, rightQuantity)) {
    return { matched: false, family, reason: "package_quantity_mismatch" };
  }
  const leftSignature = commoditySignature(left, family);
  const rightSignature = commoditySignature(right, family);
  const matched = Boolean(leftSignature && leftSignature === rightSignature);
  return {
    matched,
    family,
    reason: matched ? "" : "commodity_variant_mismatch",
    signature: matched ? `${leftSignature}; exact package quantity` : "",
  };
}
