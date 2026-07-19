const POUNDS_PER_KILOGRAM = 2.2046226218;
const OUNCES_PER_POUND = 16;

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundedCurrency(value) {
  return Number(value.toFixed(2));
}

function normalizedUnit(rawUnit) {
  return String(rawUnit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function pricePerPound(amount, rawUnit) {
  const value = positiveNumber(amount);
  if (value == null) return null;
  const unit = normalizedUnit(rawUnit);
  if (/^(?:lb|lbs|pound|pounds)$/.test(unit)) return roundedCurrency(value);
  if (/^(?:oz|ounce|ounces)$/.test(unit)) return roundedCurrency(value * OUNCES_PER_POUND);
  if (/^(?:kg|kilogram|kilograms)$/.test(unit)) return roundedCurrency(value / POUNDS_PER_KILOGRAM);
  if (/^(?:g|gram|grams)$/.test(unit)) return roundedCurrency((value * 1000) / POUNDS_PER_KILOGRAM);
  return null;
}

export function weightInPounds(amount, rawUnit) {
  const value = positiveNumber(amount);
  if (value == null) return null;
  const unit = normalizedUnit(rawUnit);
  if (/^(?:lb|lbs|pound|pounds)$/.test(unit)) return value;
  if (/^(?:oz|ounce|ounces)$/.test(unit)) return value / OUNCES_PER_POUND;
  if (/^(?:kg|kilogram|kilograms)$/.test(unit)) return value * POUNDS_PER_KILOGRAM;
  if (/^(?:g|gram|grams)$/.test(unit)) return (value / 1000) * POUNDS_PER_KILOGRAM;
  return null;
}

function money(match) {
  return match ? positiveNumber(match[1].replaceAll(",", "")) : null;
}

export function parseInstacartProductDetailText(text) {
  const visibleText = String(text ?? "");
  const directUnitMatch = visibleText.match(
    /Current price:\s*\$([\d,]+(?:\.\d{1,2})?)\s*\/\s*(lb|lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?)\b/i,
  );
  const anyUnitMatch = directUnitMatch ?? visibleText.match(
    /\$([\d,]+(?:\.\d{1,2})?)\s*\/\s*(lb|lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?)\b/i,
  );
  const estimatedItemMatch = visibleText.match(
    /Current price:\s*\$([\d,]+(?:\.\d{1,2})?)\s*each\s*\(est\.?\)/i,
  );
  const averageWeightMatch = visibleText.match(
    /About\s+(\d+(?:\.\d+)?)\s*(lb|lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?)\s+each\b/i,
  );
  const sourceUnitPrice = money(anyUnitMatch);
  const unitPrice = anyUnitMatch
    ? pricePerPound(sourceUnitPrice, anyUnitMatch[2])
    : null;
  const estimatedWeightLb = averageWeightMatch
    ? weightInPounds(averageWeightMatch[1], averageWeightMatch[2])
    : null;
  const finalCostByWeight = /Final cost by weight/i.test(visibleText);

  if (unitPrice != null && (finalCostByWeight || directUnitMatch)) {
    return {
      pricingMode: finalCostByWeight ? "final_cost_by_weight" : "unit_price_per_lb",
      priceBasis: "per lb",
      unitPrice,
      sourceUnitPrice,
      sourceUnit: anyUnitMatch[2].toLowerCase(),
      estimatedItemPrice: money(estimatedItemMatch),
      estimatedWeightLb,
      comparisonEligible: true,
      exclusionReason: "",
    };
  }

  return {
    pricingMode: finalCostByWeight ? "unverified_variable_weight" : "fixed_price",
    priceBasis: "",
    unitPrice: null,
    sourceUnitPrice,
    sourceUnit: anyUnitMatch?.[2]?.toLowerCase() ?? "",
    estimatedItemPrice: money(estimatedItemMatch),
    estimatedWeightLb,
    comparisonEligible: !finalCostByWeight,
    exclusionReason: finalCostByWeight ? "missing_weight_unit_price" : "",
  };
}

export function parseCapturedUnitText(text) {
  const unitText = String(text ?? "");
  const slashUnitMatch = unitText.match(
    /\$([\d,]+(?:\.\d{1,2})?)\s*(?:\/|per)\s*(lb|lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?|fl\.?\s*oz|fluid\s+ounces?)\b/i,
  );
  const proseUnitMatch = unitText.match(
    /\bprice\s+per\s+(lb|lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?|fl\.?\s*oz|fluid\s+ounces?)\s*:?\s*\$([\d,]+(?:\.\d{1,2})?)/i,
  );
  const itemMatch = unitText.match(
    /\$([\d,]+(?:\.\d{1,2})?)\s*(?:each|\/\s*ea)\b/i,
  );
  const sourceUnitPrice = slashUnitMatch
    ? money(slashUnitMatch)
    : positiveNumber(proseUnitMatch?.[2]?.replaceAll(",", ""));
  const sourceUnit = slashUnitMatch?.[2] ?? proseUnitMatch?.[1] ?? "";
  const unitPrice = sourceUnitPrice != null
    ? pricePerPound(sourceUnitPrice, sourceUnit)
    : null;
  return {
    unitPrice,
    sourceUnitPrice,
    sourceUnit: sourceUnit.toLowerCase(),
    estimatedItemPrice: money(itemMatch),
  };
}

export function instacartPricingKey(record) {
  return `${record?.storeId ?? ""}|${record?.id ?? ""}`;
}

function productPath(productUrl) {
  try {
    return new URL(String(productUrl ?? "")).pathname.toLowerCase();
  } catch {
    return "";
  }
}

export function isUnverifiedVariableWeightRecord(record) {
  if (String(record?.priceBasis ?? "").toLowerCase() === "per lb") return false;
  if (record?.pricingMode === "final_cost_by_weight" || record?.pricingMode === "unit_price_per_lb") return false;
  if (String(record?.size ?? "").trim()) return false;

  const category = String(record?.category ?? "").toLowerCase();
  const path = productPath(record?.productUrl);
  const eachSlug = /-each$/.test(path);
  const explicitUnitSlug = /-per-(?:lb|pound)$/.test(path);
  const onePoundSlug = /-1-(?:0-)?lb$/.test(path);

  if (explicitUnitSlug) return true;
  if (/\bproduce\b/.test(category) && (eachSlug || onePoundSlug)) return true;
  if (/\b(?:meat|seafood)\b/.test(category) && (eachSlug || onePoundSlug)) return true;
  if (/\b(?:deli|prepared)\b/.test(category) && onePoundSlug) return true;
  return false;
}

export function isAmbiguousSingleServingBeverageRecord(record) {
  const name = String(record?.name ?? record?.title ?? "");
  if (!/\b(?:soda|cola|root beer|sparkling water|seltzer|tonic water|energy drink)\b/i.test(name)) return false;
  const size = String(record?.size ?? "");
  if (/\b(?:\d+\s*[x×]|pack|pk|count|ct)\b/i.test(size)) return false;
  const serving = size.match(/\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fz|fluid ounces?)\b/i);
  if (!serving || Number(serving[1]) > 20) return false;
  const prices = [record?.price, record?.originalPrice]
    .map(positiveNumber)
    .filter((price) => price != null);
  return prices.length > 0 && Math.max(...prices) >= 6;
}

export function validateInstacartWeightDetail(detail) {
  const unitPrice = positiveNumber(detail?.unitPrice);
  if (!detail?.id || !detail?.storeId || !detail?.productUrl) {
    throw new Error("Instacart weight detail requires id, storeId, and productUrl");
  }
  if (!["final_cost_by_weight", "unit_price_per_lb"].includes(detail?.pricingMode)) {
    throw new Error(`Unsupported Instacart pricing mode for ${instacartPricingKey(detail)}`);
  }
  if (detail?.priceBasis !== "per lb" || unitPrice == null) {
    throw new Error(`Invalid per-pound detail for ${instacartPricingKey(detail)}`);
  }
  const urlProductId = productPath(detail.productUrl).match(/^\/products\/(\d+)-/)?.[1];
  if (urlProductId && urlProductId !== String(detail.id)) {
    throw new Error(`Product URL ID mismatch for ${instacartPricingKey(detail)}`);
  }
  return {
    ...detail,
    unitPrice: roundedCurrency(unitPrice),
    estimatedItemPrice: positiveNumber(detail.estimatedItemPrice),
    estimatedWeightLb: positiveNumber(detail.estimatedWeightLb),
  };
}

export function createInstacartWeightDetailIndex(details) {
  const index = new Map();
  for (const rawDetail of details?.records ?? []) {
    const detail = validateInstacartWeightDetail(rawDetail);
    const key = instacartPricingKey(detail);
    if (index.has(key)) throw new Error(`Duplicate Instacart weight detail ${key}`);
    index.set(key, detail);
  }
  return index;
}

export function normalizeInstacartRecord(record, detail = null) {
  if (detail) {
    const verified = validateInstacartWeightDetail(detail);
    const key = instacartPricingKey(record);
    if (instacartPricingKey(verified) !== key) {
      throw new Error(`Instacart weight detail key mismatch for ${key}`);
    }
    if (verified.productUrl !== record.productUrl) {
      throw new Error(`Instacart weight detail URL mismatch for ${key}`);
    }
    return {
      ...record,
      rawCapturedPrice: record.price,
      price: verified.unitPrice,
      originalPrice: null,
      priceBasis: "per lb",
      pricingMode: verified.pricingMode,
      estimatedItemPrice: verified.estimatedItemPrice,
      estimatedWeightLb: verified.estimatedWeightLb,
      sourceUnitPrice: verified.sourceUnitPrice ?? verified.unitPrice,
      sourceUnit: verified.sourceUnit ?? "lb",
      comparisonEligible: true,
      exclusionReason: "",
      capturedAt: verified.capturedAt ?? record.capturedAt,
      capturedUrl: verified.productUrl,
    };
  }

  if (String(record?.priceBasis ?? "").toLowerCase() === "per lb") {
    return {
      ...record,
      pricingMode: record.pricingMode ?? "unit_price_per_lb",
      comparisonEligible: true,
      exclusionReason: "",
    };
  }

  const unverifiedVariableWeight = isUnverifiedVariableWeightRecord(record);
  const ambiguousPackageCount = isAmbiguousSingleServingBeverageRecord(record);
  return {
    ...record,
    pricingMode: unverifiedVariableWeight
      ? "unverified_variable_weight"
      : ambiguousPackageCount
        ? "ambiguous_package_count"
        : "fixed_price",
    comparisonEligible: !unverifiedVariableWeight && !ambiguousPackageCount,
    exclusionReason: unverifiedVariableWeight
      ? "unverified_variable_weight_price"
      : ambiguousPackageCount
        ? "ambiguous_package_count"
        : "",
  };
}

export function normalizeInstacartRecords(records, details) {
  const detailIndex = createInstacartWeightDetailIndex(details);
  return records.map((record) => normalizeInstacartRecord(
    record,
    detailIndex.get(instacartPricingKey(record)) ?? null,
  ));
}

const fixedPackagePattern = /\b(?:bag|bagged|bowl|bunch|clamshell|count|ct|cut|diced|florets|pack|peeled|prepacked|sliced|stalks|tray)\b/i;
const rawMeatPattern = /\b(?:beef|bison|chicken|cod|crab|fish|halibut|lamb|lobster|pork|salmon|scallop|shrimp|steak|trout|turkey|veal)\b/i;
const looseProducePattern = /\b(?:apple|avocado|banana|broccoli|cabbage|celery root|cucumber|eggplant|grapefruit|jalapeno|lemon|lime|melon|orange|onion|parsnip|pepper|pluot|squash|tomato|yam)\b/i;

export function isDirectVariableWeightRecord(record) {
  if (String(record?.priceBasis ?? "").toLowerCase() === "per lb") return true;
  if (String(record?.size ?? "").trim()) return false;
  const parsed = parseCapturedUnitText(record?.unitText);
  if (parsed.unitPrice == null) return false;
  const title = String(record?.title ?? record?.name ?? "");
  if (rawMeatPattern.test(title)) return true;
  if (fixedPackagePattern.test(title)) return false;
  return /\bproduce\b/i.test(String(record?.category ?? "")) || looseProducePattern.test(title);
}

export function normalizeDirectStoreRecord(record) {
  const rawPerPound = String(record?.priceBasis ?? "").toLowerCase() === "per lb";
  const parsed = parseCapturedUnitText(record?.unitText);
  const ambiguousPackageCount = isAmbiguousSingleServingBeverageRecord(record);
  if (!isDirectVariableWeightRecord(record)) {
    return {
      ...record,
      pricingMode: ambiguousPackageCount ? "ambiguous_package_count" : "fixed_price",
      comparisonEligible: !ambiguousPackageCount,
      exclusionReason: ambiguousPackageCount ? "ambiguous_package_count" : "",
    };
  }

  // Some direct-store cards label an estimated each total as "per lb" while
  // exposing the actual unit rate separately (for example, "$0.69/lb"). When
  // no parseable rate is present, retain an already-canonical per-pound price.
  if (parsed.unitPrice == null && rawPerPound) {
    return {
      ...record,
      pricingMode: record.pricingMode ?? "unit_price_per_lb",
      comparisonEligible: true,
      exclusionReason: "",
    };
  }
  if (parsed.unitPrice == null) {
    return {
      ...record,
      pricingMode: "fixed_price",
      comparisonEligible: true,
      exclusionReason: "",
    };
  }

  const rawCapturedPrice = positiveNumber(record.price);
  const hasEstimatedItemPrice = parsed.estimatedItemPrice != null
    || (
      rawCapturedPrice != null
      && parsed.unitPrice != null
      && Math.abs(rawCapturedPrice - parsed.unitPrice) >= 0.01
    );
  return {
    ...record,
    rawCapturedPrice: record.price,
    price: parsed.unitPrice,
    originalPrice: null,
    priceBasis: "per lb",
    pricingMode: hasEstimatedItemPrice ? "final_cost_by_weight" : "unit_price_per_lb",
    estimatedItemPrice: hasEstimatedItemPrice
      ? parsed.estimatedItemPrice ?? rawCapturedPrice
      : null,
    sourceUnitPrice: parsed.sourceUnitPrice,
    sourceUnit: parsed.sourceUnit,
    comparisonEligible: true,
    exclusionReason: "",
  };
}

export function normalizeDirectStoreRecords(records) {
  return records.map(normalizeDirectStoreRecord);
}
