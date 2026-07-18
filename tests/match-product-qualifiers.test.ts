import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  crossSourceQualifiersCompatible,
  numericProductVariantsCompatible,
  productQualifierEvidence,
  productQualifiersCompatible,
  protectedQualifierClaims,
} from "../scripts/match-product-qualifiers.mjs";
import {
  packagedProductVariantsCompatible,
  productUrlVariantHints,
} from "../scripts/match-packaged-variants.mjs";
import { isSourceExclusiveProduct } from "../scripts/source-exclusive-products.mjs";

test("protected qualifiers must agree before product names can match", () => {
  assert.equal(
    productQualifiersCompatible(
      "Bob's Red Mill Whole Wheat Flour, Organic",
      "Bob's Red Mill Flour, Whole Wheat",
    ),
    false,
  );
  assert.equal(
    productQualifiersCompatible(
      "Bob's Red Mill Whole Wheat Flour, Organic",
      "Bob's Red Mill Organic Whole Wheat Flour",
    ),
    true,
  );
  assert.equal(
    productQualifiersCompatible(
      "Bob's Red Mill Flour, Whole Wheat",
      "Bob's Red Mill 100% Stone Ground Whole Wheat Flour",
    ),
    true,
  );
  assert.equal(
    productQualifiersCompatible(
      "Applegate Gluten-Free Chicken Nuggets",
      "Applegate Chicken Nuggets",
    ),
    false,
  );
  assert.equal(
    productQualifiersCompatible(
      "Pirate's Booty Aged White Cheddar Non-GMO",
      "Pirate's Booty Aged White Cheddar",
    ),
    false,
  );
  assert.equal(
    productQualifiersCompatible(
      "Newman's Own Plant-Based Fig Cookies",
      "Newman's Own Fig Cookies",
    ),
    false,
  );
});

test("protected qualifier spelling and punctuation are normalized", () => {
  assert.deepEqual(protectedQualifierClaims("Non-organic, GlutenFree, GMO-free snack"), {
    organic: false,
    glutenFree: true,
    dairyFree: false,
    vegan: false,
    sodiumState: null,
    sugarState: null,
    nonGmo: true,
    plantBased: false,
    grassFed: false,
    grainFed: false,
    pastureRaised: false,
    freeRange: false,
    vegetarianFed: false,
    airChilled: false,
    wildCaught: false,
    farmRaised: false,
    boneState: null,
    skinState: null,
    frozenState: null,
    leanPercent: null,
    grade: null,
    angus: false,
    wagyu: false,
    heritage: false,
    noAntibiotics: false,
    humane: false,
    halal: false,
    kosher: false,
    natural: false,
    ribMeat: false,
    valuePack: false,
    bulk: false,
    waterState: null,
    smoked: false,
    marinated: false,
    seasoned: false,
    uncured: false,
  });
  assert.deepEqual(protectedQualifierClaims("Organic plant based snack"), {
    organic: true,
    glutenFree: false,
    dairyFree: false,
    vegan: false,
    sodiumState: null,
    sugarState: null,
    nonGmo: false,
    plantBased: true,
    grassFed: false,
    grainFed: false,
    pastureRaised: false,
    freeRange: false,
    vegetarianFed: false,
    airChilled: false,
    wildCaught: false,
    farmRaised: false,
    boneState: null,
    skinState: null,
    frozenState: null,
    leanPercent: null,
    grade: null,
    angus: false,
    wagyu: false,
    heritage: false,
    noAntibiotics: false,
    humane: false,
    halal: false,
    kosher: false,
    natural: false,
    ribMeat: false,
    valuePack: false,
    bulk: false,
    waterState: null,
    smoked: false,
    marinated: false,
    seasoned: false,
    uncured: false,
  });
});

test("ingredient-level organic wording is not promoted to a whole-product organic claim", () => {
  assert.equal(
    protectedQualifierClaims("Amy's Macaroni and Cheese, Made With Organic Pasta").organic,
    false,
  );
  assert.equal(
    protectedQualifierClaims("Chocolate snack made from 70% organic ingredients").organic,
    false,
  );
  assert.equal(
    protectedQualifierClaims("Amy's Organic Macaroni and Cheese").organic,
    true,
  );
});

test("cross-source matching protects dietary and formulation variants", () => {
  assert.equal(
    crossSourceQualifiersCompatible(
      "Amy's Gluten Free Dairy Free Rice Mac & Cheeze",
      "Amy's Gluten Free Rice Mac & Cheeze",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Amy's Organic Lentil Soup",
      "Amy's Low Sodium Organic Lentil Soup",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Lily's No Sugar Added White Chocolate Chips",
      "Lily's White Chocolate Chips",
    ),
    false,
  );
});

test("packaged product variants reject flavor, protein, format, and preparation changes", () => {
  assert.equal(
    packagedProductVariantsCompatible(
      "Tru Fru Frozen Cherries in White & Dark Chocolate",
      "Tru Fru Frozen Raspberries in White & Dark Chocolate",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Applegate Oven Roasted Turkey Breast Sliced",
      "Applegate Oven Roasted Chicken Breast Sliced",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Field Roast Chao Creamery Vegan Shreds",
      "Field Roast Chao Vegan Slices",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Kettle Sea Salt and Vinegar Potato Chips",
      "Kettle Air Fried Sea Salt and Vinegar Potato Chips",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Siete Grain Free Mexican Wedding Cookies",
      "Siete Grain Free Mexican Vanilla Chocolate Chip Cookies",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Califia Farms Oat Barista Blend Oat Milk",
      "Califia Farms Almond Barista Blend Creamer",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Dave's Killer Bread Powerseed Organic Bread",
      "Dave's Killer Bread Supreme Sourdough Organic Bread",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Muir Glen Organic Tomato Sauce",
      "Muir Glen Organic Pizza Sauce",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Califia Farms Unsweetened Almond Milk",
      "Califia Farms Unsweetened Vanilla Almond Milk",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "OLIPOP Cream Soda",
      "OLIPOP Banana Cream Soda",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "OLIPOP Orange Cream Soda",
      "OLIPOP Cream Soda",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Boursin Garlic & Fine Herbs Cheese",
      "Boursin Hot Honey Garlic Cheese",
    ),
    false,
  );
  for (const [left, right] of [
    [
      "Tillamook Farmstyle Sharp Cheddar Cheese Slices",
      "Tillamook Whole Milk Mozzarella Cheese Slices",
    ],
    [
      "Saffron Road Chicken Tikka Masala Frozen Meal",
      "Saffron Road Chicken Biryani Frozen Meal",
    ],
    [
      "Boulder Canyon Classic Sea Salt Potato Chips",
      "Boulder Canyon Malt Vinegar & Sea Salt Potato Chips",
    ],
    [
      "Poppi Prebiotic Soda Cherry Cola",
      "Poppi Prebiotic Soda Classic Cola",
    ],
    [
      "Primal Kitchen Classic BBQ Sauce",
      "Primal Kitchen Hawaiian Style BBQ Sauce",
    ],
    [
      "Applegate Chicken & Maple Breakfast Sausage",
      "Applegate Sage Breakfast Chicken Sausage",
    ],
    [
      "Bob's Red Mill Buttermilk Pancake & Waffle Mix",
      "Bob's Red Mill Buckwheat Pancake & Waffle Mix",
    ],
    [
      "El Yucateco Red Chile Habanero Hot Sauce",
      "El Yucateco Green Chile Habanero Hot Sauce",
    ],
    [
      "Guerrero Yellow Corn Tortillas",
      "Guerrero White Corn Tortillas",
    ],
    [
      "Naked Bread Organic Wheat Bread",
      "Naked Bread Organic Great Seed Bread",
    ],
    [
      "Naked Bread Organic Wheat Bread",
      "Naked Organic Twenty Four Bread",
    ],
    [
      "SkinnyDipped Dark Chocolate Peanut Butter Almonds",
      "SkinnyDipped Dark Chocolate Cocoa Almonds",
    ],
    [
      "Bob's Red Mill Gluten Free Muesli",
      "Bob's Red Mill Gluten Free Flaxseed Meal",
    ],
    [
      "Marie Callender's Original Corn Bread Mix",
      "Marie Callender's Honey Butter Corn Bread Mix",
    ],
    [
      "Truvia Calorie-Free Sweetener Jar",
      "Truvia Calorie-Free Sweetener Packets",
    ],
    [
      "Earth Balance Organic Butter Spread",
      "Earth Balance Whipped Organic Butter Spread",
    ],
    [
      "Perfect Bar Dark Chocolate Chip Peanut Butter Protein Bar",
      "Perfect Bar Chocolate Mint Peanut Butter Protein Bar",
    ],
    [
      "Crofter's Organic Apricot Premium Fruit Spread",
      "Crofter's Organic Raspberry Premium Fruit Spread",
    ],
    [
      "Reese's White Thins Peanut Butter Cups",
      "Reese's Dark Chocolate Thins Peanut Butter Cups",
    ],
    [
      "nutpods Unsweetened French Vanilla Creamer",
      "nutpods French Vanilla Oat Creamer",
    ],
    [
      "Kettle Brand Backyard Barbeque Potato Chips",
      "Kettle Brand Jalapeno Potato Chips",
    ],
    [
      "Ruffles Sour Cream & Onion Potato Chips",
      "Ruffles Cheddar & Sour Cream Potato Chips",
    ],
    [
      "Jasberry Organic Original Superfood Rice",
      "Jasberry Organic Coconut Superfood Rice",
    ],
    [
      "Crave Brothers Fresh Mozzarella Ball",
      "Crave Brothers Fresh Mozzarella Perline",
    ],
    [
      "Wonderful Lightly Salted Pistachios",
      "Wonderful Roasted & Salted Pistachios",
    ],
    [
      "Miracle Whip Light Mayo-Like Dressing",
      "Miracle Whip Mayo-Like Dressing",
    ],
    [
      "TAZO Classic Chai Latte Concentrate",
      "TAZO Skinny Chai Latte Concentrate",
    ],
    [
      "Gardein Spicy Chick'n Filets",
      "Gardein Chick'n Filets",
    ],
    [
      "Tate's Oatmeal Raisin Cookies",
      "Tate's Lemon Cookies",
    ],
    [
      "Boulder Canyon Malt Vinegar & Sea Salt Potato Chips",
      "Boulder Canyon Salt N Pepper Potato Chips",
    ],
    [
      "Wild Planet Skipjack Wild Tuna",
      "Wild Planet Skipjack Tuna with Dill Pickle",
    ],
    [
      "Santa Cruz Organic Cinnamon Applesauce",
      "Santa Cruz Organic Applesauce",
    ],
    [
      "Jell-O Lemon Instant Pudding",
      "Jell-O Butterscotch Instant Pudding",
    ],
    [
      "Seattle Sourdough Classic French Bread",
      "Seattle Sourdough Classic Sourdough Bread",
    ],
    [
      "Heinz Tomato Ketchup",
      "Heinz Simply Tomato Ketchup",
    ],
    [
      "CHIPS AHOY! Chunky Fudgy Chocolate Chip Cookies",
      "CHIPS AHOY! Original Chocolate Chip Cookies",
    ],
    [
      "TRISCUIT Cracked Pepper & Olive Oil Crackers",
      "TRISCUIT Rosemary & Olive Oil Crackers",
    ],
    [
      "Sara Lee White Bread",
      "Sara Lee Sourdough Bread",
    ],
    [
      "Hidden Valley Buffalo Ranch Chicken Strips with Ranch Cup",
      "Hidden Valley Ranch Dippers Ranch Style",
    ],
    [
      `Planet Oat Oatmilk ${productUrlVariantHints(
        "https://www.instacart.com/products/35622673-planet-oat-oatmilk-barista-lovers-52-fl-oz",
      )}`,
      "Planet Oat Unsweetened Extra Creamy Oatmilk",
    ],
    [
      "Lavazza Dolcevita Classico Medium Roast Ground Coffee",
      "Lavazza Dolcevita Classico Medium Roast Whole Bean Coffee",
    ],
    [
      "Pillsbury Cinnamon Rolls Cream Cheese Icing 5 ea",
      "Pillsbury Original Cinnamon Rolls 5 count",
    ],
    [
      "ALOHA Chocolate Chip Cookie Dough Protein Bar 1.98 oz",
      "ALOHA Chocolate Chip Cookie Dough Protein Bar 5pk 1.98 oz",
    ],
    [
      "ALOHA Chocolate Chip Cookie Dough Protein Bar 5pk 1.98 oz",
      "ALOHA Chocolate Chip Cookie Dough Protein Bar 1.98 oz",
    ],
  ]) {
    assert.equal(
      packagedProductVariantsCompatible(left, right),
      false,
      `${left} must not match ${right}`,
    );
  }
  assert.equal(
    packagedProductVariantsCompatible(
      "Culture Pop Orange Mango & Lime 4 x 12 fl oz",
      "Culture Pop Orange Mango & Lime 4pk, 12 FZ",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Siete Almond Flour Tortillas 8 ct",
      "Siete Almond Flour Tortillas 7 oz (Pack of 1), 8 ct",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Quaker Chocolate Chip Granola Bars 8 ct",
      "Quaker Chocolate Chip Granola Bars 8 x 0.84 oz",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Heinz Tomato Ketchup with No Artificial Sweeteners",
      "Heinz Simply Tomato Ketchup",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Marie Callender's Buffalo-Style Chicken Mac and Cheese",
      "Marie Callender's Buffalo-Style Mac and Cheese",
    ),
    true,
  );
});

test("explicit retailer house brands are separated from national-brand candidates", () => {
  assert.equal(
    isSourceExclusiveProduct("amazon_whole_foods", {
      brand: "365 by Whole Foods Market",
      title: "Organic Black Beans",
    }),
    true,
  );
  assert.equal(
    isSourceExclusiveProduct("safeway.com", { title: "O Organics Black Beans" }),
    true,
  );
  assert.equal(
    isSourceExclusiveProduct("qfc.com", { title: "Kroger Black Beans" }),
    true,
  );
  assert.equal(
    isSourceExclusiveProduct("qfc.com", { title: "S&W Black Beans" }),
    false,
  );
  assert.equal(
    isSourceExclusiveProduct("amazon_whole_foods", {
      brand: "Amazon Fresh",
      title: "365 by Whole Foods Market Organic Black Beans",
    }),
    true,
  );
});

test("meat and seafood claims must agree across sources", () => {
  assert.equal(
    crossSourceQualifiersCompatible(
      "Organic 100% Grass Fed 90% Lean Ground Beef",
      "Organic 100% Grass-Fed 90/10 Ground Beef",
    ),
    true,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Organic Grass Fed Ground Beef",
      "Organic Ground Beef",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Air Chilled Boneless Skinless Chicken Breast",
      "Boneless Skinless Chicken Breast",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Fresh Wild Caught Sockeye Salmon Fillet",
      "Fresh Farm Raised Sockeye Salmon Fillet",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "USDA Choice Bone-In Ribeye Steak",
      "USDA Prime Boneless Ribeye Steak",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "80/20 Grain-Finished Ground Beef",
      "80% Lean 20% Fat Ground Beef",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Organic Chicken Breast no antibiotics free range with rib meat",
      "Organic Chicken Breast no antibiotics free range",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Free Range Duck Breast raised without the use of antibiotics, no retained water",
      "Free Range Duck Breast raised without any antibiotics, retained water",
    ),
    false,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "80/20 Ground Beef Value Pack",
      "80% Lean 20% Fat Ground Beef",
    ),
    false,
  );
});

test("cross-source titles may add marketing claims but not product variants", () => {
  assert.equal(
    crossSourceQualifiersCompatible(
      "Bob's Red Mill Artisan Bread Flour",
      "Bob's Red Mill Artisan Bread Flour, Non-GMO, Vegan",
    ),
    true,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Aloha Organic Protein Bar",
      "Aloha Organic Plant-Based Protein Bar",
    ),
    true,
  );
  assert.equal(
    crossSourceQualifiersCompatible(
      "Applegate Gluten-Free Chicken Nuggets",
      "Applegate Chicken Nuggets",
    ),
    false,
  );
});

test("numeric product formulas must agree after package quantities are removed", () => {
  assert.equal(
    numericProductVariantsCompatible(
      "Food for Life Ezekiel 4:9 Bread Organic Sprouted Whole Grain",
      "Food for Life Organic 7 Sprouted Whole Grain Bread, 24 oz",
    ),
    false,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Kroger 80/20 Ground Beef Pack 1 lb",
      "Signature Select 80% Lean 20% Fat Ground Beef - 1.35 lb",
    ),
    true,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Organic Whole Milk, 64 fl oz",
      "Organic Whole Milk, 0.5 gallon",
    ),
    true,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Synergy Gingerberry",
      "Synergy Gingerberry - 16 Fl. Oz.",
    ),
    true,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Culture Pop Watermelon",
      "Culture Pop Watermelon - 12 FZ",
    ),
    true,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "2% Reduced Fat Milk, 64 fl oz",
      "Whole Milk, 64 fl oz",
    ),
    false,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Formula 100 Daily Supplement, 60 ct",
      "Formula Daily Supplement, 60 count",
    ),
    false,
  );
});

test("generated aliases keep protected product variants separate", async () => {
  const [aliases, checkpoint] = await Promise.all([
    readFile(new URL("../data/instacart-aliases.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/capture-checkpoint.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  assert.notEqual(aliases.aliases["30819"], aliases.aliases["69208"]);
  assert.notEqual(aliases.aliases["20512209"], aliases.aliases["20648053"]);
  assert.notEqual(aliases.aliases["129868"], aliases.aliases["2693522"]);
  assert.notEqual(aliases.aliases["27550057"], aliases.aliases["27550065"]);
  assert.notEqual(aliases.aliases["53166"], aliases.aliases["177050"]);
  assert.notEqual(aliases.aliases["17159"], aliases.aliases["26848"]);
  assert.notEqual(aliases.aliases["192190"], aliases.aliases["29132"]);
  assert.notEqual(aliases.aliases["28123038"], aliases.aliases["27638690"]);
  assert.notEqual(aliases.aliases["27638690"], aliases.aliases["25153011"]);

  const recordsById = new Map<string, Array<{
    name: string;
    size?: string;
    productUrl?: string;
    qualifierText?: string;
  }>>();
  for (const record of checkpoint.records) {
    const records = recordsById.get(record.id) ?? [];
    records.push(record);
    recordsById.set(record.id, records);
  }
  const commonClaims = [
    "organic",
    "glutenFree",
    "dairyFree",
    "sodiumState",
    "sugarState",
    "nonGmo",
    "plantBased",
  ] as const;
  const meatClaims = [
    "grassFed",
    "grainFed",
    "pastureRaised",
    "freeRange",
    "vegetarianFed",
    "airChilled",
    "wildCaught",
    "farmRaised",
    "boneState",
    "skinState",
    "frozenState",
    "leanPercent",
    "grade",
    "angus",
    "wagyu",
    "heritage",
    "noAntibiotics",
    "humane",
    "halal",
    "kosher",
    "natural",
    "ribMeat",
    "valuePack",
    "bulk",
    "waterState",
    "smoked",
    "marinated",
    "seasoned",
    "uncured",
  ] as const;
  for (const cluster of aliases.clusters) {
    if (cluster.productIds.length < 2) continue;
    const records: Array<{
      name: string;
      size?: string;
      productUrl?: string;
      qualifierText?: string;
    }> = cluster.productIds.flatMap(
      (id: string) => recordsById.get(id) ?? [],
    );
    const evidence = records.map(productQualifierEvidence);
    const claims = /\b(?:beef|bison|chicken|cod|crab|fish|halibut|ham|lamb|meat|pork|salmon|scallop|seafood|shrimp|steak|trout|tuna|turkey)\b/i.test(evidence.join(" "))
      ? [...commonClaims, ...meatClaims]
      : commonClaims;
    for (const claim of claims) {
      const states = new Set(records.map((record) => (
        protectedQualifierClaims(productQualifierEvidence(record))[claim]
      )));
      assert.equal(
        states.size,
        1,
        `Alias cluster ${cluster.productIds.join(", ")} mixes ${claim} variants`,
      );
    }
    for (let index = 0; index < records.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < records.length; otherIndex += 1) {
        assert.equal(
          packagedProductVariantsCompatible(
            `${records[index].name} ${records[index].size ?? ""} ${productUrlVariantHints(records[index].productUrl)}`,
            `${records[otherIndex].name} ${records[otherIndex].size ?? ""} ${productUrlVariantHints(records[otherIndex].productUrl)}`,
          ),
          true,
          `Alias cluster ${cluster.productIds.join(", ")} mixes packaged variants`,
        );
      }
    }
  }
});
