import assert from "node:assert/strict";
import test from "node:test";

import {
  looseMeatKey,
  looseMeatMatches,
} from "../scripts/match-loose-meat.mjs";

const category = "Meat & Seafood";

test("loose meat normalizes retailer branding but preserves the cut", () => {
  assert.equal(
    looseMeatKey({
      title: "PCC Organic Boneless Skinless Chicken Thighs",
      category,
      priceBasis: "per lb",
    }),
    "chicken thigh",
  );
  assert.equal(
    looseMeatMatches(
      {
        title: "PCC Organic Boneless Skinless Chicken Thighs",
        category,
        priceBasis: "per lb",
        qualifierText: "Free range, no antibiotics, non-GMO, no water added",
      },
      {
        title: "O Organics Organic Boneless & Skinless Chicken Thigh",
        category,
        priceBasis: "per lb",
        qualifierText: "Free range, no antibiotics, non-GMO, no water added",
      },
    ),
    true,
  );
  assert.equal(
    looseMeatMatches(
      { category, priceBasis: "per lb", title: "90% Lean Ground Beef" },
      { category, priceBasis: "per lb", title: "90/10 Ground Beef" },
    ),
    true,
  );
  assert.equal(
    looseMeatMatches(
      { category, priceBasis: "per lb", title: "Signature Select 80% Lean 20% Fat Ground Beef - 1.35 Lb" },
      { category, priceBasis: "per lb", title: "Kroger 80/20 Ground Beef Pack 1 LB" },
    ),
    true,
  );
});

test("loose meat requires matching premium and physical claims", () => {
  const base = { category, priceBasis: "per lb" };
  assert.equal(
    looseMeatMatches(
      { ...base, title: "Organic Grass Fed 90% Lean Ground Beef" },
      { ...base, title: "Organic 90/10 Ground Beef" },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "Air Chilled Boneless Skinless Chicken Breast" },
      { ...base, title: "Boneless Skinless Chicken Breast" },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "Wild Caught Fresh Sockeye Salmon Fillet" },
      { ...base, title: "Farm Raised Fresh Sockeye Salmon Fillet" },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "USDA Choice Bone-In Ribeye Steak" },
      { ...base, title: "USDA Choice Boneless Ribeye Steak" },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "Organic Boneless Skinless Chicken Breast" },
      {
        ...base,
        title: "Organic Boneless Skinless Chicken Breast",
        qualifierText: "Non-GMO, free range, no antibiotics ever, with rib meat",
      },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "Organic Boneless Skinless Chicken Breast" },
      { ...base, title: "Organic Boneless Skinless Chicken Breast" },
    ),
    false,
  );
  assert.equal(
    looseMeatMatches(
      { ...base, title: "80% Lean 20% Fat Ground Beef Value Pack" },
      { ...base, title: "80/20 Ground Beef" },
    ),
    false,
  );
});

test("loose meat accepts explicit per-pound package estimates but excludes prepared products", () => {
  assert.equal(
    looseMeatKey({
      title: "O Organics Organic Boneless Skinless Chicken Breasts - 1.5 Lb",
      size: "1.5 lb",
      category,
      priceBasis: "per lb",
    }),
    "chicken breast",
  );
  assert.equal(
    looseMeatKey({
      title: "Organic Ground Beef",
      size: "1 lb",
      category,
      priceBasis: "per item",
    }),
    null,
  );
  assert.equal(
    looseMeatKey({
      title: "Organic Ground Beef",
      category,
      productUrl: "/organic-ground-beef-per-lb",
      priceBasis: "per item",
    }),
    null,
  );
  assert.equal(looseMeatKey({ title: "Organic Marinated Chicken Breast", category, priceBasis: "per lb" }), null);
  assert.equal(looseMeatKey({ title: "Organic Chicken Sausage", category, priceBasis: "per lb" }), null);
  assert.equal(looseMeatKey({ title: "Plant-Based Chicken Breast", category, priceBasis: "per lb" }), null);
});
