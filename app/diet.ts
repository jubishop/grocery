export const DIET_OPTIONS = [
  { value: "gluten-free", label: "Gluten-free claim", badge: "Gluten-free" },
  { value: "vegan", label: "Vegan claim", badge: "Vegan" },
  { value: "vegetarian", label: "Vegetarian claim", badge: "Vegetarian" },
  { value: "plant-based", label: "Plant-based claim", badge: "Plant-based" },
  { value: "dairy-free", label: "Dairy-free claim", badge: "Dairy-free" },
  { value: "lactose-free", label: "Lactose-free claim", badge: "Lactose-free" },
  { value: "keto", label: "Keto claim", badge: "Keto" },
  { value: "paleo", label: "Paleo claim", badge: "Paleo" },
] as const;

export type DietClaim = (typeof DIET_OPTIONS)[number]["value"];
export type DietFilter = "all" | DietClaim;

type DietSearchableProduct = {
  name: string;
  size?: string;
};

const dietPatterns: Record<DietClaim, RegExp> = {
  "gluten-free": /\bgluten[\s-]*free\b/i,
  vegan: /\bvegan\b/i,
  vegetarian: /\bvegetarian\b/i,
  "plant-based": /\bplant[\s-]*based\b/i,
  "dairy-free": /\bdairy[\s-]*free\b/i,
  "lactose-free": /\blactose[\s-]*free\b/i,
  keto: /\bketo\b/i,
  paleo: /\bpaleo\b/i,
};

export function productHasDietClaim(product: DietSearchableProduct, diet: DietFilter) {
  if (diet === "all") return true;
  return dietPatterns[diet].test(`${product.name} ${product.size ?? ""}`);
}

export function getDietOption(diet: DietClaim) {
  return DIET_OPTIONS.find((option) => option.value === diet)!;
}
