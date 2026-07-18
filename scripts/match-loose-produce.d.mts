export type LooseProduceRecord = {
  title?: string;
  name?: string;
  category?: string;
  size?: string;
  priceBasis?: string;
  productUrl?: string;
  qualifierText?: string;
};

export function looseProduceKey(record: LooseProduceRecord): string | null;
export function looseProduceBasis(record: LooseProduceRecord): "per item" | "per lb";
export function looseProduceMatches(left: LooseProduceRecord, right: LooseProduceRecord): boolean;
