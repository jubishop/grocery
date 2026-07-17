import assert from "node:assert/strict";
import test from "node:test";

import {
  compareBasketByStore,
  MAX_BASKET_QUANTITY,
  sanitizeBasket,
} from "../app/basket.ts";

test("sanitizeBasket keeps valid whole quantities and drops stale entries", () => {
  const result = sanitizeBasket(
    {
      apples: 2.8,
      bread: MAX_BASKET_QUANTITY + 20,
      stale: 1,
      milk: 0,
      eggs: "2",
    },
    new Set(["apples", "bread", "milk", "eggs"]),
  );

  assert.deepEqual(result, {
    apples: 2,
    bread: MAX_BASKET_QUANTITY,
  });
});

test("compareBasketByStore applies quantities and ranks complete baskets by total", () => {
  const comparisons = compareBasketByStore(
    [
      {
        id: "apples",
        name: "Apples",
        quantity: 2,
        prices: {
          first: { price: 1.25 },
          second: { price: 1.5 },
        },
      },
      {
        id: "bread",
        name: "Bread",
        quantity: 1,
        prices: {
          first: { price: 4.5 },
          second: { price: 3.25 },
        },
      },
    ],
    ["first", "second"],
  );

  assert.deepEqual(comparisons, [
    {
      storeId: "second",
      total: 6.25,
      complete: true,
      missingItems: [],
    },
    {
      storeId: "first",
      total: 7,
      complete: true,
      missingItems: [],
    },
  ]);
});

test("incomplete stores are ranked after complete stores and expose only a subtotal", () => {
  const comparisons = compareBasketByStore(
    [
      {
        id: "milk",
        name: "Milk",
        quantity: 1,
        prices: {
          complete: { price: 5.49 },
          missing: { price: 4.99 },
        },
      },
      {
        id: "eggs",
        name: "Eggs",
        quantity: 2,
        prices: {
          complete: { price: 3.5 },
        },
      },
    ],
    ["missing", "complete"],
  );

  assert.deepEqual(comparisons, [
    {
      storeId: "complete",
      total: 12.49,
      complete: true,
      missingItems: [],
    },
    {
      storeId: "missing",
      total: 4.99,
      complete: false,
      missingItems: [{ id: "eggs", name: "Eggs" }],
    },
  ]);
});
