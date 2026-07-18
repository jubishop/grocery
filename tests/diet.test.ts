import assert from "node:assert/strict";
import test from "node:test";

import {
  getDietOption,
  productHasDietClaim,
} from "../app/diet.ts";

test("diet matching recognizes explicit catalog claims and common punctuation", () => {
  assert.equal(
    productHasDietClaim({ name: "Applegate Gluten-Free Chicken Nuggets" }, "gluten-free"),
    true,
  );
  assert.equal(
    productHasDietClaim({ name: "Organic GlutenFree Pasta" }, "gluten-free"),
    true,
  );
  assert.equal(
    productHasDietClaim({ name: "Vegan Plant Based Breakfast Patties" }, "plant-based"),
    true,
  );
  assert.equal(
    productHasDietClaim({ name: "Lactose Free Whole Milk" }, "lactose-free"),
    true,
  );
});

test("diet matching does not infer a claim from a naturally compatible product", () => {
  assert.equal(
    productHasDietClaim({ name: "Organic Bananas" }, "gluten-free"),
    false,
  );
  assert.equal(
    productHasDietClaim({ name: "Almond Beverage" }, "vegan"),
    false,
  );
  assert.equal(
    productHasDietClaim({ name: "Non-Dairy Creamer" }, "dairy-free"),
    false,
  );
});

test("all diets matches every product and option metadata stays available", () => {
  assert.equal(productHasDietClaim({ name: "Sourdough Bread" }, "all"), true);
  assert.equal(getDietOption("gluten-free").badge, "Gluten-free");
});
