function qualifierText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function hasOrganicClaim(value) {
  const normalized = qualifierText(value);
  if (/\bnon organic\b/.test(normalized)) return false;
  return /\borganic\b/.test(normalized);
}

export function organicQualifiersCompatible(left, right) {
  return hasOrganicClaim(left) === hasOrganicClaim(right);
}
