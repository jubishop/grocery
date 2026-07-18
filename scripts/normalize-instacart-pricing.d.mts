export type InstacartRecord = Record<string, any>;

export function pricePerPound(amount: unknown, rawUnit: unknown): number | null;
export function weightInPounds(amount: unknown, rawUnit: unknown): number | null;
export function parseInstacartProductDetailText(text: unknown): Record<string, any>;
export function parseCapturedUnitText(text: unknown): Record<string, any>;
export function instacartPricingKey(record: InstacartRecord): string;
export function isUnverifiedVariableWeightRecord(record: InstacartRecord): boolean;
export function validateInstacartWeightDetail(detail: InstacartRecord): InstacartRecord;
export function createInstacartWeightDetailIndex(details: { records?: InstacartRecord[] }): Map<string, InstacartRecord>;
export function normalizeInstacartRecord(record: InstacartRecord, detail?: InstacartRecord | null): InstacartRecord;
export function normalizeInstacartRecords(
  records: InstacartRecord[],
  details: { records?: InstacartRecord[] },
): InstacartRecord[];
export function isDirectVariableWeightRecord(record: InstacartRecord): boolean;
export function normalizeDirectStoreRecord(record: InstacartRecord): InstacartRecord;
export function normalizeDirectStoreRecords(records: InstacartRecord[]): InstacartRecord[];
