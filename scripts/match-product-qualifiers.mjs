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
  return {
    organic: /\borganic\b/.test(normalized) && !/\bnon organic\b/.test(normalized),
    glutenFree: /\bgluten\s*free\b/.test(normalized),
    nonGmo: /\b(?:non\s*gmo|gmo\s*free)\b/.test(normalized),
    plantBased: /\bplant\s*based\b/.test(normalized),
  };
}

function qualifiersCompatible(left, right, claims) {
  const leftClaims = protectedQualifierClaims(left);
  const rightClaims = protectedQualifierClaims(right);
  return claims.every((claim) => leftClaims[claim] === rightClaims[claim]);
}

export function productQualifiersCompatible(left, right) {
  return qualifiersCompatible(left, right, ["organic", "glutenFree", "nonGmo", "plantBased"]);
}

export function crossSourceQualifiersCompatible(left, right) {
  return qualifiersCompatible(left, right, ["organic", "glutenFree"]);
}
