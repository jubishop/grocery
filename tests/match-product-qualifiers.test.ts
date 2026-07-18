import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  crossSourceQualifiersCompatible,
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
  });
  assert.deepEqual(protectedQualifierClaims("Organic plant based snack"), {
    organic: true,
    glutenFree: false,
    nonGmo: false,
    plantBased: true,
  });
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

  const recordsById = new Map<string, Array<{ name: string }>>();
  for (const record of checkpoint.records) {
    const records = recordsById.get(record.id) ?? [];
    records.push(record);
    recordsById.set(record.id, records);
  }
  const claims = ["organic", "glutenFree", "nonGmo", "plantBased"] as const;
  for (const cluster of aliases.clusters) {
    if (cluster.productIds.length < 2) continue;
    const records: Array<{ name: string }> = cluster.productIds.flatMap(
      (id: string) => recordsById.get(id) ?? [],
    );
    for (const claim of claims) {
      const states = new Set(records.map((record) => protectedQualifierClaims(record.name)[claim]));
      assert.equal(
        states.size,
        1,
        `Alias cluster ${cluster.productIds.join(", ")} mixes ${claim} variants`,
      );
    }
  }
});
