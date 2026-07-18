import type { LooseProduceRecord } from "./match-loose-produce.mjs";

export function looseMeatKey(record: LooseProduceRecord): string | null;
export function looseMeatMatches(left: LooseProduceRecord, right: LooseProduceRecord): boolean;
