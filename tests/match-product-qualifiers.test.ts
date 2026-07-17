import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasOrganicClaim,
  organicQualifiersCompatible,
} from "../scripts/match-product-qualifiers.mjs";

test("organic qualifiers must agree before product names can match", () => {
  assert.equal(
    organicQualifiersCompatible(
      "Bob's Red Mill Whole Wheat Flour, Organic",
      "Bob's Red Mill Flour, Whole Wheat",
    ),
    false,
  );
  assert.equal(
    organicQualifiersCompatible(
      "Bob's Red Mill Whole Wheat Flour, Organic",
      "Bob's Red Mill Organic Whole Wheat Flour",
    ),
    true,
  );
  assert.equal(
    organicQualifiersCompatible(
      "Bob's Red Mill Flour, Whole Wheat",
      "Bob's Red Mill 100% Stone Ground Whole Wheat Flour",
    ),
    true,
  );
});

test("an explicit non-organic label is treated as conventional", () => {
  assert.equal(hasOrganicClaim("Non-organic whole wheat flour"), false);
  assert.equal(
    organicQualifiersCompatible(
      "Non-organic whole wheat flour",
      "Whole wheat flour",
    ),
    true,
  );
});

test("generated aliases keep Bob's Red Mill organic and conventional flour separate", async () => {
  const aliases = JSON.parse(
    await readFile(new URL("../data/instacart-aliases.json", import.meta.url), "utf8"),
  );

  assert.notEqual(aliases.aliases["30819"], aliases.aliases["69208"]);
  assert.notEqual(aliases.aliases["20512209"], aliases.aliases["20648053"]);
});
