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
  assert.equal(
    protectedQualifierClaims("Organic Girl Baby Arugula").organic,
    false,
  );
  assert.equal(
    protectedQualifierClaims("Organic Girl Organic Baby Spinach").organic,
    true,
  );
  assert.equal(
    protectedQualifierClaims("Field Roast Smoked Apple Sage Sausage - 12.9 Oz").leanPercent,
    null,
  );
  assert.equal(
    protectedQualifierClaims("80/20 Ground Beef").leanPercent,
    "80",
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
      "Muir Glen Organic Diced Tomatoes",
      "Muir Glen Organic Diced Fire Roasted Tomatoes",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Muir Glen Organic Diced Tomatoes",
      "Muir Glen Organic Crushed Tomatoes",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Cento All Purpose Crushed Tomatoes",
      "Cento Tomatoes Crushed All Purpose",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Eden Foods Cannellini White Kidney Beans",
      "Eden Foods Organic White Kidney Beans",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Muir Glen Organic Diced Tomatoes",
      "Muir Glen Organic Petite Diced Tomatoes",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Imagine Organic Tomato Creamy Soup",
      "Imagine Organic Tomato Basil Creamy Soup",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Las Palmas Medium Enchilada Sauce",
      "Las Palmas Medium Green Chile Enchilada Sauce",
    ),
    false,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Pacific Foods Organic Free Range Chicken Stock",
      "Pacific Foods Organic Free Range Chicken Broth",
    ),
    false,
  );
  for (const [left, right] of [
    [
      "Certified Angus Beef 90% Lean Ground Beef Chuck",
      "Certified Angus Ground Beef 90% Lean Sirloin",
    ],
    [
      "Jif Creamy Peanut Butter",
      "Jif Creamy Natural Peanut Butter",
    ],
    [
      "Monster Energy Ultra Zero Sugar Energy Drink 12 Pack",
      "Monster Energy Ultra Variety Pack 12 Pack",
    ],
    [
      "Rao's Roasted Garlic Pasta Sauce",
      "Rao's Creamy Roasted Garlic Pasta Sauce",
    ],
    [
      "Welch's 100% Grape Juice",
      "Welch's 100% White Grape Juice",
    ],
    [
      "Alani Nu Cotton Candy Energy Drink black cherry",
      "Alani Nu Purple Cotton Candy Energy Drink",
    ],
  ]) {
    assert.equal(
      packagedProductVariantsCompatible(left, right),
      false,
      `${left} should not match ${right}`,
    );
  }
  for (const [left, right] of [
    [
      "Bakery Fresh Traditional Variety Cookies",
      "Bakery Fresh Traditional Variety Pack Cookies",
    ],
    [
      "Flavortown O.G. Buffalo Wing Sauce",
      "Flavortown O.G. Buffalo Sauce, Classic Wing and Chicken Tender Dipping Sauce",
    ],
    [
      "MaraNatha Natural Creamy Raw Almond Butter",
      "MaraNatha Creamy Raw California Almond Butter",
    ],
    [
      `Annie's Deluxe Shells and Aged Cheddar Pasta and Cheese Sauce ${
        productUrlVariantHints("https://www.instacart.com/products/24304-annie-s-deluxe-rich-creamy-shells-aged-cheddar-macaroni-cheese-sauce")
      }`,
      "Annies Homegrown Macaroni & Cheese Sauce Creamy Deluxe Aged Cheddar Box",
    ],
    [
      "Perdue Chicken Tenders Gluten Free Organic",
      "PERDUE SIMPLY SMART ORGANIC Gluten Free Breaded Chicken Breast Tenders",
    ],
  ]) {
    assert.equal(
      packagedProductVariantsCompatible(left, right),
      true,
      `${left} should match ${right}`,
    );
  }
  for (const [left, right] of [
    [
      "Annie's Gluten Free Rice Pasta and Cheddar Cheese",
      "Annie's Gluten Free Rice Pasta and White Cheddar Cheese",
    ],
    ["Chobani Vanilla Greek Nonfat Yogurt", "Chobani Zero Sugar Vanilla Greek Nonfat Yogurt"],
    ["Wildwood Organic Firm Tofu", "Wildwood Extra Firm Organic Tofu"],
    ["Bobo's Chocolate Chip Oat Bar", "Bobo's Peanut Butter Chocolate Chip Oat Bar"],
    ["Kettle & Fire Organic Chicken Broth", "Kettle & Fire Organic Chicken Bone Broth"],
    ["Darigold Reduced Fat Ultra Filtered Milk", "Darigold Chocolate Reduced Fat Ultra Filtered Milk"],
    ["Silk Original Almond Milk", "Silk Unsweetened Almond Milk"],
    ["Chef Boyardee Beef Ravioli", "Chef Boyardee Mini Beef Ravioli"],
    ["Spindrift Lime Sparkling Water", "Spindrift Raspberry Lime Sparkling Water"],
    ["Oroweat Country Style White Bread", "Oroweat Country Style Buttermilk White Bread"],
    ["Ball Park Beef Hot Dogs", "Ball Park Bun Length Beef Hot Dogs"],
    ["Oscar Mayer Naturally Hardwood Smoked Bacon", "Oscar Mayer Naturally Hardwood Smoked Thick Cut Bacon"],
    ["Bundaberg Ginger Beer", "Bundaberg Diet Ginger Beer"],
    ["Gold Medal All Purpose Flour", "Gold Medal Unbleached All Purpose Flour"],
    ["Bragg Organic Apple Cider Vinegar", "Bragg Organic Raw Unfiltered Apple Cider Vinegar"],
    ["Siete Kettle Cooked Sea Salt Potato Chips", "Siete Kettle Cooked Sea Salt Vinegar Potato Chips"],
    ["Eggland's Best Cage Free Large White Eggs", "Eggland's Best Cage Free Extra Large White Eggs"],
    ["Almond Breeze Vanilla Almondmilk", "Almond Breeze Unsweetened Vanilla Almondmilk"],
    ["Polar Lime Seltzer", "Polar Cranberry Lime Seltzer"],
    ["Häagen-Dazs Vanilla Ice Cream", "Häagen-Dazs Vanilla Bean Ice Cream"],
    ["Mission Soft Taco Flour Tortillas", "Mission Spinach and Herb Soft Taco Flour Tortillas"],
    ["Jimmy Dean Sausage Egg and Cheese Breakfast Sandwiches", "Jimmy Dean Turkey Sausage Egg White and Cheese Breakfast Sandwiches"],
    ["Happy Snacks Animal Crackers", "Happy Snacks Chocolate Animal Crackers"],
    ["Follow Your Heart Feta Cheese Crumbles", "Follow Your Heart Bleu Cheese Crumbles"],
    ["House Foods Firm Tofu", "House Foods Medium Firm Tofu"],
    ["Morton and Bassett Paprika", "Morton and Bassett Smoked Paprika"],
    ["Planet Oat Original Oatmilk", "Planet Oat Extra Creamy Original Oatmilk"],
    ["NILLA Vanilla Wafers", "NILLA Mini Vanilla Wafers"],
    ["Häagen-Dazs Coffee Ice Cream", "Häagen-Dazs Coffee Chip Ice Cream"],
    ["Hormel Chili with Beans", "Hormel Turkey Chili with Beans"],
    ["Wendy's Baconator Chili With Beans, Beef & Bacon", "Wendy's Chili With Beans"],
    ["Kettle & Fire Classic Chicken Bone Broth", "Kettle & Fire Butter Chicken Bone Broth"],
    ["S&W White Chili Beans", "S&W Premium Chili Beans"],
    ["S&W Black Chili Beans", "S&W White Chili Beans"],
    ["BelGioioso Fresh Mozzarella Cheese Ball", "BelGioioso Smoked Fresh Mozzarella Cheese Ball"],
    ["Organic Girl Baby Spinach & Arugula", "Organic Girl Baby Arugula"],
    ["SunButter Original Sunflower Seed Butter", "SunButter Natural Sunflower Butter"],
    ["Fresh Express Caesar Supreme Salad Kit", "Fresh Express Chopped Caesar Salad Kit"],
    ["Celestial Seasonings Throat Coat Tea", "Celestial Seasonings Eucalyptus Throat Coat Tea"],
    ["Jell-O Vanilla Pudding", "Jell-O French Vanilla Pudding"],
    ["Betty Crocker Chocolate Chip Cookie Mix", "Betty Crocker Oatmeal Chocolate Chip Cookie Mix"],
    ["Mountain Dew Zero Sugar Soda", "Mountain Dew Baja Blast Zero Sugar Soda"],
    ["Eden Foods Organic Pumpkin Seeds", "Eden Foods Organic Spicy Pumpkin Seeds"],
    ["Dandies Vegan Vanilla Marshmallows", "Dandies Vegan Vanilla Mini Marshmallows"],
    ["Tate's Butter Crunch Cookies", "Tate's Snickerdoodle Cookies"],
    ["Ortega Fire Roasted Hot Diced Green Chiles", "Ortega Fire Roasted Diced Green Chiles"],
    ["Gerber Very Berry Fruit and Veggie Melts", "Gerber Fruit and Veggie Melts"],
    ["Bumble Bee Solid White Albacore Tuna", "Bumble Bee Solid White Albacore Tuna in Vegetable Oil"],
    ["Häagen-Dazs Chocolate Chip Ice Cream", "Häagen-Dazs Chocolate Chip Cookie Dough Ice Cream"],
    ["Yogi Egyptian Licorice Tea", "Yogi Egyptian Licorice Mint Tea"],
    ["North Coast Organic Apple Juice", "North Coast Organic Honeycrisp Apple Juice"],
    [
      "Hu Organic Hazelnut Butter Dark Chocolate Bar",
      "Hu Kitchen Organic Cashew Butter Filled Dark Chocolate Bar",
    ],
    [
      "Kettle Brand Salt & Ground Pepper Potato Chips",
      "Kettle Brand Sea Salt Potato Chips",
    ],
    [
      "Organic Valley 3 Cheese Organic Finely Shredded Mexican Cheese Blend",
      "Organic Valley 3 Cheese Organic Thick Cut Shredded Mexican Cheese Blend",
    ],
    [
      "Birch Benders Organic Buttermilk Pancake & Waffle Mix",
      "Birch Benders Classic Organic Pancake & Waffle Mix",
    ],
    [
      "Perfect Bar Dark Chocolate Chip Peanut Butter Protein Bar 2.3 oz",
      "Perfect Bar Dark Chocolate Chip Peanut Butter Protein Bar 4 count, 2.3 oz",
    ],
    [
      "Annie's Organic Birthday Cake Bunny Grahams",
      "Annie's Organic Neapolitan Bunny Grahams",
    ],
    [
      "Annie's Star Pasta & Chicken Soup",
      "Annie's Bunny Pasta & Chicken Broth Soup",
    ],
    [
      "Ben & Jerry's Milk & Cookies Ice Cream",
      "Ben & Jerry's Vanilla Ice Cream",
    ],
    [
      "Traditional Medicinals Peppermint Delight Probiotic Tea",
      "Traditional Medicinals Organic Peppermint Tea",
    ],
    [
      "Traditional Medicinals Organic Eater's Digest, Peppermint",
      "Traditional Medicinals Organic Peppermint Tea",
    ],
    [
      "Horizon Organic Reduced Fat Organic Milk",
      "Horizon Organic DHA Reduced Fat Organic Milk",
    ],
    [
      "Organic Valley Organic Mozzarella Cheese Block 8 oz",
      "Organic Valley Stringles Mozzarella String Cheese Sticks 8 Count (8 oz)",
    ],
    [
      "Country Archer Beef & Cheese Minis Beef Sticks 16 x 0.5 oz",
      "Country Archer Mini Beef Original Sticks 16 Count, 8 oz",
    ],
    [
      "Near East Original Rice Pilaf Mix 6.09 oz",
      "Near East Original Rice Pilaf Mix 3 Count, 6 oz",
    ],
    [
      "Mineragua Sparkling Water 12.5 fl oz",
      "Mineragua Sparkling Water 9 Count, 12.5 fl oz",
    ],
    [
      "Chomps Original Turkey Stick 1.15 oz",
      "Chomps Original Turkey Sticks 8 Count, 1.15 oz",
    ],
    ["Matiz Paella Rice", "Matiz Bomba Paella Rice"],
    [
      "Almond Breeze Unsweetened Vanilla Almondmilk",
      "Almond Breeze Shelf-Stable Unsweetened Vanilla Almondmilk",
    ],
    [
      "Fishwife Albacore Tuna in Olive Oil",
      "Fishwife Albacore Tuna in Spicy Olive Oil",
    ],
    [
      "Bumble Bee Solid White Albacore Tuna in Water",
      "Bumble Bee Gourmet Solid White Albacore Tuna in Water",
    ],
    [
      "Lucini Italia Extra Virgin Olive Oil",
      "Lucini Italia Premium Select Extra Virgin Olive Oil",
    ],
    [
      "California Olive Ranch California Grown Extra Virgin Olive Oil",
      "California Olive Ranch Everyday Extra Virgin Olive Oil",
    ],
    [
      `La Tourangelle Organic Extra Virgin Olive Oil ${productUrlVariantHints(
        "https://www.instacart.com/products/1704540-la-tourangelle-olive-oil-extra-virgin-early-harvest-25-4-oz",
      )}`,
      `La Tourangelle Organic Extra Virgin Olive Oil ${productUrlVariantHints(
        "https://www.instacart.com/products/30021143-la-tourangelle-fruity-extra-virgin-olive-oil-25-4-fl-oz",
      )}`,
    ],
    [
      `Bragg Organic Raw Unfiltered Apple Cider Vinegar ${productUrlVariantHints(
        "https://www.instacart.com/products/32676672-bragg-organic-apple-cider-vinegar-honey-cayenne-wellness-cleanse-16-fl-oz",
      )}`,
      "Bragg Organic Raw Unfiltered Apple Cider Vinegar",
    ],
    [
      "Dave's Killer Bread Organic Plain Awesome Bagels",
      "Dave's Killer Bread Summer Berry Limited Edition Organic Bagels",
    ],
    [
      "Chobani Flip Low-Fat Greek Yogurt S'mores",
      "Chobani Flip Cookies & Cream Low-Fat Greek Yogurt",
    ],
    [
      "Pam Non-Stick Olive Oil Cooking Spray",
      "Pam Avocado Oil Non-Stick Cooking Spray",
    ],
    [
      "Suja Organic Probiotic Watermelon Wellness Shot",
      "Suja Organic Digestion Watermelon Wellness Shot",
    ],
    [
      "Ben & Jerry's Peanut Butter Cup Ice Cream",
      "Ben & Jerry's Peanut Butter Half Baked Ice Cream",
    ],
    [
      "Ben & Jerry's Peanut Butter Half Baked Ice Cream",
      "Ben & Jerry's Chocolate Peanut Butter Split Ice Cream",
    ],
    [
      "Starbucks Almondmilk & Oatmilk Pumpkin Spice Coffee Creamer",
      "Starbucks Almondmilk & Oatmilk Caramel Coffee Creamer",
    ],
    [
      "Pop-Tarts Frosted Strawberry Toaster Pastries",
      "Pop-Tarts Frosted Strawberry Cheesecake Toaster Pastries",
    ],
    ["Gold Peak Sweet Tea", "Gold Peak Slightly Sweet Tea"],
    [
      "Celestial Seasonings Sleepytime Herbal Tea",
      "Celestial Seasonings Sleepytime Extra Herbal Tea",
    ],
    [
      "Franz Original Whole Grain English Muffins",
      "Franz Original English Muffins",
    ],
    [
      "Quaker Oats Honey Raisins & Almonds Granola",
      "Quaker Oats Honey Raisins Granola",
    ],
    [
      "BelGioioso Fresh Mozzarella Cheese Ball",
      "BelGioioso Ciliegine Fresh Mozzarella Cheese Ball",
    ],
    [
      "Taylor Farms Protein Caesar Chopped Salad Kit",
      "Taylor Farms Caesar Chopped Salad Kit",
    ],
    [
      "Marie Callender's Creamy Mushroom Chicken Pot Pie",
      "Marie Callender's Chicken Pot Pie",
    ],
    [
      "Hidden Valley Ranch Salad Dressing",
      "Hidden Valley Coleslaw Ranch Salad Dressing",
    ],
    [
      "Pillsbury Funfetti Yellow Cake Mix with Candy Bits",
      "Pillsbury Spring Funfetti Cake Mix with Candy Bits",
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
    [
      "Organic English Seedless Cucumber 1 ct",
      "Organic Cucumber 1 ct",
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
      "Nature's Path Organic Frosted Wildberry Acai Toaster Pastries 11 oz",
      "Nature's Path Organic Frosted Wildberry Acai Toaster Pastries 6 Count, 11 oz",
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
  assert.equal(
    packagedProductVariantsCompatible(
      "Poppi Prebiotic Soda Strawberry Lemon",
      "Poppi Sparkling Prebiotic Soda with Apple Cider Vinegar and Fruit Juice, Strawberry Lemon Flavor",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Milkadamia Unsweetened Macadamia Milk",
      "Milkadamia Milk Macadamia Unsweetned",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Wild Planet Solid Wild Albacore Tuna in Extra Virgin Olive Oil",
      "Wild Planet Wild Albacore Tuna in Olive Oil",
    ),
    true,
  );
  assert.equal(
    packagedProductVariantsCompatible(
      "Wild Planet Solid Wild Albacore Tuna in Extra Virgin Olive Oil",
      "Wild Planet Wild Albacore Tuna in Water",
    ),
    false,
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
      "Kettle Brand Party Size Backyard Barbeque Potato Chips",
      "Kettle Brand Backyard Barbeque Potato Chips, 13 Oz 1 bag",
    ),
    true,
  );
  assert.equal(
    numericProductVariantsCompatible(
      "Silk Vanilla Soy Creamer",
      "Silk Vanilla Soy Creamer From the No. 1 Brand, 32 fl oz",
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
  assert.notEqual(aliases.aliases["27263236"], aliases.aliases["25654917"]);
  assert.notEqual(aliases.aliases["27261977"], aliases.aliases["25654920"]);
  assert.notEqual(aliases.aliases["27262004"], aliases.aliases["25654919"]);
  assert.notEqual(aliases.aliases["27261978"], aliases.aliases["25654921"]);

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
