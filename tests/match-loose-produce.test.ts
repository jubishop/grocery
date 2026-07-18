import assert from "node:assert/strict";
import test from "node:test";

import {
  looseProduceBasis,
  looseProduceKey,
  looseProduceMatches,
} from "../scripts/match-loose-produce.mjs";

test("loose produce names ignore retailer each wording", () => {
  assert.equal(
    looseProduceKey({ title: "Fresh Organic Broccoli, 1 Each", category: "Produce" }),
    "organic broccoli",
  );
  assert.equal(
    looseProduceKey({ title: "Fresh Organic English Cucumbers", size: "1 ct", category: "Produce" }),
    "organic english cucumber",
  );
  assert.equal(
    looseProduceKey({ title: "Fresh Ripe Whole Pineapple", category: "Produce" }),
    "pineapple",
  );
  assert.equal(
    looseProduceMatches(
      { title: "Organic Yellow Onion", category: "Produce", priceBasis: "per lb" },
      { title: "O Organics Organic Yellow Onions", category: "Produce", priceBasis: "per lb" },
    ),
    true,
  );
  assert.equal(
    looseProduceMatches(
      { title: "Living Butter Lettuce", category: "Produce", priceBasis: "per item" },
      { title: "Signature Farms Living Butter Lettuce, 1 Count", category: "Produce", priceBasis: "per item" },
    ),
    true,
  );
  assert.equal(
    looseProduceMatches(
      { name: "Organic Broccoli", category: "Produce", productUrl: "/organic-broccoli-each" },
      { title: "Organic Broccoli, 1 Each", category: "Produce" },
    ),
    true,
  );
});

test("loose produce keeps organic status and variety distinct", () => {
  assert.equal(
    looseProduceMatches(
      { name: "Organic Valencia Orange", category: "Produce" },
      { title: "Navel Orange, 1 Each", category: "Produce" },
    ),
    false,
  );
  assert.equal(
    looseProduceMatches(
      { name: "Organic Lemon", category: "Produce" },
      { title: "Lemon, 1 Each", category: "Produce" },
    ),
    false,
  );
});

test("loose produce does not merge packages, prepared produce, or unlike selling bases", () => {
  assert.equal(looseProduceKey({ title: "Organic Broccoli Florets, 10 oz", category: "Produce" }), null);
  assert.equal(looseProduceKey({ title: "Organic Lemons, 2 lb Bag", category: "Produce" }), null);
  assert.equal(looseProduceKey({ title: "Organic Avocados, 4 ct", category: "Produce" }), null);
  assert.equal(looseProduceKey({ title: "Signature Farms Hass Avocados Bagged - Each", category: "Produce" }), null);
  assert.equal(
    looseProduceMatches(
      { name: "Organic Fuji Apple", category: "Produce", productUrl: "/organic-fuji-apple-each" },
      { title: "Organic Fuji Apple – Each", category: "Produce", priceBasis: "per lb" },
    ),
    false,
  );
  assert.equal(looseProduceBasis({ title: "Broccoli Crown", priceBasis: "per lb" }), "per lb");
});
