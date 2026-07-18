export interface SourceProductRecord {
  brand?: unknown;
  title?: unknown;
  name?: unknown;
}

export function isSourceExclusiveProduct(
  source: string,
  record: SourceProductRecord | null | undefined,
): boolean;
