const sourcePatterns = {
  amazon_whole_foods: [
    /^\s*365\s+by\s+whole\s+foods\s+market\b/i,
    /^\s*whole\s+foods\s+market\b/i,
  ],
  "safeway.com": [
    /^\s*signature\s+(?:select|farms)\b/i,
    /^\s*o\s+organics\b/i,
    /^\s*open\s+nature\b/i,
    /^\s*lucerne\b/i,
    /^\s*primo\s+taglio\b/i,
    /^\s*value\s+corner\b/i,
    /^\s*waterfront\s+bistro\b/i,
    /^\s*readymeals\b/i,
  ],
  "qfc.com": [
    /^\s*kroger\b/i,
    /^\s*simple\s+truth\b/i,
    /^\s*private\s+selection\b/i,
    /^\s*heritage\s+farm\b/i,
    /^\s*comforts\b/i,
  ],
  instacart: [
    /^\s*365\s+by\s+whole\s+foods\s+market\b/i,
    /^\s*whole\s+foods\s+market\b/i,
    /^\s*pcc\b/i,
    /^\s*metropolitan\s+market\b/i,
    /^\s*signature\s+(?:select|farms)\b/i,
    /^\s*o\s+organics\b/i,
    /^\s*open\s+nature\b/i,
    /^\s*lucerne\b/i,
    /^\s*kroger\b/i,
    /^\s*simple\s+truth\b/i,
    /^\s*private\s+selection\b/i,
  ],
  "traderjoes.com": [
    /^\s*trader\s+joes\b/i,
  ],
};

export function isSourceExclusiveProduct(source, record) {
  const patterns = sourcePatterns[source] ?? [];
  const values = [
    record?.brand,
    record?.title,
    record?.name,
  ].filter(Boolean);
  return values.some((value) => {
    const text = String(value).replace(/[’']/g, "").trim();
    return patterns.some((pattern) => pattern.test(text));
  });
}
