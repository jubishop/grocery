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

  const recordsById = new Map<string, Array<{ name: string; qualifierText?: string }>>();
  for (const record of checkpoint.records) {
    const records = recordsById.get(record.id) ?? [];
    records.push(record);
    recordsById.set(record.id, records);
  }
  const commonClaims = [
    "organic",
    "glutenFree",
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
    const records: Array<{ name: string; qualifierText?: string }> = cluster.productIds.flatMap(
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
  }
});
