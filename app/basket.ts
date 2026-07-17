export const MAX_BASKET_QUANTITY = 99;

export type BasketQuantities = Record<string, number>;

export type BasketProductForComparison<StoreId extends string> = {
  id: string;
  name: string;
  quantity: number;
  prices: Partial<Record<StoreId, { price: number }>>;
};

export type BasketStoreComparison<StoreId extends string> = {
  storeId: StoreId;
  total: number;
  complete: boolean;
  missingItems: Array<{ id: string; name: string }>;
};

export function sanitizeBasket(
  value: unknown,
  validProductIds: ReadonlySet<string>,
): BasketQuantities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([productId, quantity]) => (
        validProductIds.has(productId)
        && typeof quantity === "number"
        && Number.isFinite(quantity)
        && quantity > 0
      ))
      .map(([productId, quantity]) => [
        productId,
        Math.min(MAX_BASKET_QUANTITY, Math.floor(quantity as number)),
      ]),
  );
}

export function compareBasketByStore<StoreId extends string>(
  products: Array<BasketProductForComparison<StoreId>>,
  storeIds: StoreId[],
): Array<BasketStoreComparison<StoreId>> {
  return storeIds
    .map((storeId) => {
      let totalCents = 0;
      const missingItems: Array<{ id: string; name: string }> = [];

      for (const product of products) {
        const price = product.prices[storeId];
        if (!price) {
          missingItems.push({ id: product.id, name: product.name });
          continue;
        }

        totalCents += Math.round(price.price * 100) * product.quantity;
      }

      return {
        storeId,
        total: totalCents / 100,
        complete: missingItems.length === 0,
        missingItems,
      };
    })
    .sort((first, second) => (
      Number(!first.complete) - Number(!second.complete)
      || first.missingItems.length - second.missingItems.length
      || first.total - second.total
      || storeIds.indexOf(first.storeId) - storeIds.indexOf(second.storeId)
    ));
}
