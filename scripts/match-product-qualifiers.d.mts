export interface ProtectedQualifierClaims {
  organic: boolean;
  glutenFree: boolean;
  nonGmo: boolean;
  plantBased: boolean;
}

export function protectedQualifierClaims(value: unknown): ProtectedQualifierClaims;
export function productQualifiersCompatible(left: unknown, right: unknown): boolean;
export function crossSourceQualifiersCompatible(left: unknown, right: unknown): boolean;
