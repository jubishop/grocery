export type CommodityRecord = {
  title?: string;
  name?: string;
  size?: string;
  category?: string;
  priceBasis?: string;
  qualifierText?: string;
};

export type PackageQuantity = {
  dimension: "count" | "mass" | "volume";
  amount: number;
};

export function packageQuantity(value: unknown): PackageQuantity | null;
export function packageQuantitiesAgree(
  left: PackageQuantity | null,
  right: PackageQuantity | null,
): boolean;
export function traderJoesCommodityFamily(record: CommodityRecord): string | null;
export function traderJoesCommodityMatch(
  left: CommodityRecord,
  right: CommodityRecord,
): {
  matched: boolean;
  family: string | null;
  reason: string;
  signature?: string;
};
