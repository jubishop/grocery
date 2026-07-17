import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instacartPath = path.join(root, "data/capture-checkpoint.json");
const wholeFoodsPath = path.join(root, "data/whole-foods-capture-checkpoint.json");
const wholeFoodsMatchesPath = path.join(root, "data/whole-foods-matches.json");
const aliasesPath = path.join(root, "data/instacart-aliases.json");
const safewayDirectPath = path.join(root, "data/safeway-direct-capture-checkpoint.json");
const safewayMatchesPath = path.join(root, "data/safeway-direct-matches.json");
const qfcDirectPath = path.join(root, "data/qfc-direct-capture-checkpoint.json");
const qfcMatchesPath = path.join(root, "data/qfc-direct-matches.json");
const schemaPath = path.join(root, "data/schema.sql");
const databasePath = path.join(root, "data/grocery-prices.sqlite");
const siteDataPath = path.join(root, "data/site-data.json");
const publicSiteDataPath = path.join(root, "public/site-data.json");

const [instacart, wholeFoods, matchData, aliases, safewayDirect, safewayMatches, qfcDirect, qfcMatches, schema] = await Promise.all([
  readFile(instacartPath, "utf8").then(JSON.parse),
  readFile(wholeFoodsPath, "utf8").then(JSON.parse),
  readFile(wholeFoodsMatchesPath, "utf8").then(JSON.parse),
  readFile(aliasesPath, "utf8").then(JSON.parse),
  readFile(safewayDirectPath, "utf8").then(JSON.parse),
  readFile(safewayMatchesPath, "utf8").then(JSON.parse),
  readFile(qfcDirectPath, "utf8").then(JSON.parse),
  readFile(qfcMatchesPath, "utf8").then(JSON.parse),
  readFile(schemaPath, "utf8"),
]);

instacart.records = instacart.records
  .filter((record) => Number.isFinite(record.price) && record.price > 0)
  .map((record) => ({
    ...record,
    sourceProductId: record.id,
    id: aliases.aliases[record.id] ?? record.id,
  }));
wholeFoods.records = wholeFoods.records.filter((record) => Number.isFinite(record.price) && record.price > 0);
safewayDirect.records = safewayDirect.records.filter((record) => Number.isFinite(record.price) && record.price > 0);
qfcDirect.records = qfcDirect.records.filter((record) => Number.isFinite(record.price) && record.price > 0);

const stores = [
  {
    id: "pcc",
    slug: "pcc-community-markets",
    name: "PCC Community Markets",
    shortName: "PCC",
    address: "2749 California Ave SW, Seattle, WA 98116",
    storeUrl: "https://www.pccmarkets.com/stores/west-seattle/",
    catalogSource: "Instacart.com",
    catalogUrl: "https://www.instacart.com/store/pcc-community-markets",
    sourceType: "Instacart marketplace",
    platformNote: "PCC's catalog is hosted by Instacart.",
    pricingPolicyTitle: "No markup, with an important caveat",
    pricingPolicySummary: "Instacart labels PCC “No markup,” while the detailed policy says prices reflect average in-store prices in the area. Individual shelf prices and in-store sales can still differ.",
    pricingPolicyUrl: "https://www.instacart.com/store/pcc-community-markets/storefront",
    termsUrl: "https://delivery.pccmarkets.com/terms",
    markupContextUrl: "",
    researchUrl: "",
    color: "#216247",
  },
  {
    id: "metro",
    slug: "metropolitan-market",
    name: "Metropolitan Market",
    shortName: "Metro",
    address: "2320 42nd Ave SW, Seattle, WA 98116",
    storeUrl: "https://metropolitan-market.com/locations/",
    catalogSource: "Instacart.com",
    catalogUrl: "https://www.instacart.com/store/metropolitan-market",
    sourceType: "Instacart marketplace + white-label storefront",
    platformNote: "Metropolitan Market's branded shop site is an Instacart-powered storefront, not an independent price source.",
    pricingPolicyTitle: "Prices may vary from in-store",
    pricingPolicySummary: "The regular catalog says prices may vary from in-store and discloses no percentage. A separate “Metropolitan Market Fast” storefront is explicitly labeled higher than in-store; that does not prove the same markup applies to this regular West Seattle corpus.",
    pricingPolicyUrl: "https://www.instacart.com/store/metropolitan-market/storefront",
    termsUrl: "https://shop.metropolitan-market.com/terms",
    markupContextUrl: "https://www.instacart.com/store/metropolitan-market-fast/storefront",
    researchUrl: "https://www.checkbook.org/puget-sound-area/supermarkets/articles/Grocery-Delivery-Pros-Cons-and-Costs-of-Having-Someone-Else-Do-Your-Shopping-7136",
    color: "#7f3b4d",
  },
  {
    id: "safeway",
    slug: "safeway",
    name: "Safeway",
    shortName: "Safeway",
    address: "2622 California Ave SW, Seattle, WA 98116",
    storeUrl: "https://local.safeway.com/safeway/wa/seattle/2622-california-ave-sw.html",
    catalogSource: "Safeway.com",
    catalogUrl: "https://www.safeway.com/",
    sourceType: "Direct retailer pickup catalog",
    platformNote: "Current comparison prices come directly from Safeway's West Seattle pickup catalog.",
    pricingPolicyTitle: "Direct source",
    pricingPolicySummary: "No Instacart Safeway prices are used in the current comparison. Older Instacart observations remain only as dated history in SQLite.",
    pricingPolicyUrl: "https://www.safeway.com/",
    termsUrl: "",
    markupContextUrl: "",
    researchUrl: "",
    color: "#b3262e",
  },
  {
    id: "qfc",
    slug: "qfc",
    name: "QFC",
    shortName: "QFC",
    address: "4550 42nd Ave SW, Seattle, WA 98116",
    storeUrl: "https://www.qfc.com/stores/grocery/wa/seattle/west-seattle/705/00883",
    catalogSource: "QFC.com",
    catalogUrl: "https://www.qfc.com/",
    sourceType: "Direct retailer pickup catalog",
    platformNote: "QFC.com is a native Kroger-platform catalog with Kroger UPCs and images, not an Instacart wrapper.",
    pricingPolicyTitle: "Direct source",
    pricingPolicySummary: "No Instacart QFC prices are used in the current comparison. Older Instacart observations remain only as dated history in SQLite.",
    pricingPolicyUrl: "https://www.qfc.com/",
    termsUrl: "",
    markupContextUrl: "",
    researchUrl: "",
    color: "#315b96",
  },
  {
    id: "wholefoods",
    slug: "whole-foods-market",
    name: "Whole Foods Market",
    shortName: "Whole Foods",
    address: "4755 Fauntleroy Way SW Ste 190, Seattle, WA 98116",
    storeUrl: "https://www.wholefoodsmarket.com/stores/westseattle",
    catalogSource: "Amazon.com",
    catalogUrl: "https://www.amazon.com/alm/storefront?almBrandId=VUZHIFdob2xlIEZvb2Rz",
    sourceType: "Direct Whole Foods pickup catalog on Amazon",
    platformNote: "Whole Foods West Seattle pickup prices were captured from Amazon's Whole Foods storefront.",
    pricingPolicyTitle: "Direct source",
    pricingPolicySummary: "The current comparison uses displayed Amazon Whole Foods pickup prices, not Instacart.",
    pricingPolicyUrl: "https://www.amazon.com/alm/storefront?almBrandId=VUZHIFdob2xlIEZvb2Rz",
    termsUrl: "",
    markupContextUrl: "",
    researchUrl: "",
    color: "#006747",
  },
];

const storeById = new Map(stores.map((store) => [store.id, store]));

function mostCommon(values, fallback = "") {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] ?? fallback;
}

function classifyProduct(name, hints = []) {
  const text = `${name} ${hints.join(" ")}`.toLowerCase();
  const has = (pattern) => pattern.test(text);
  if (has(/\b(tofu|tempeh|plant[- ]based|vegan|oat ?milk|almond ?milk|coconut ?milk|non[- ]dairy|meatless|miyoko|field roast|gardein)\b/)) return "Plant-Based";
  if (has(/\b(yogurt|yoghurt|cheese|cheddar|mozzarella|parmesan|milk|butter|cream|half & half|half-and-half|kefir|cottage cheese|sour cream)\b|egg/)) return "Dairy & Eggs";
  if (has(/\b(chicken|beef|turkey|pork|bacon|sausage|ham|salami|pepperoni|prosciutto|salmon|shrimp|cod|steak|meatball|hot dog)\b/)) return "Meat & Seafood";
  if (has(/\b(frozen|pizza|ice cream|gelato|sorbet|popsicle|frozen meal|frozen dinner)\b/)) return "Frozen";
  if (has(/\b(bread|bagel|bun|rolls?\b|tortilla|pita|naan|english muffin|croissant|bakery)\b/)) return "Bakery & Bread";
  if (has(/\b(cereal|granola|oatmeal|porridge|waffle|pancake|breakfast)\b/)) return "Breakfast & Cereal";
  if (has(/\b(pasta|spaghetti|penne|linguine|fettuccine|macaroni|marinara|pasta sauce|noodles?|ravioli)\b/)) return "Pasta & Sauces";
  if (has(/\b(soup|broth|stock|canned|beans?\b|tomato paste|chili)\b/)) return "Canned & Soup";
  if (has(/\b(flour|baking|sugar|yeast|baking chips?|chocolate morsels?|cake mix|brownie mix|cornstarch|vanilla extract)\b/)) return "Baking";
  if (has(/\b(mayonnaise|veganaise|mustard|ketchup|dressing|salsa|hot sauce|vinegar|olive oil|avocado oil|soy sauce|tamari|teriyaki|barbecue sauce|bbq sauce|stir-fry|condiment)\b/)) return "Condiments & Oils";
  if (has(/\b(chips?|crackers?|grahams?|popcorn|cookies?|chocolate|pretzels?|snack|protein bar|energy bar|granola bar|fruit bar|trail bar|nuts?\b|trail mix)\b/)) return "Snacks";
  if (has(/\b(coffee|tea|water|seltzer|sparkling|soda|juice|kombucha|lemonade|beverage|drink)\b/)) return "Beverages";
  if (has(/\b(rice|quinoa|grain|lentils?|oats?\b|peanut butter|almond butter|nut butter|jam|jelly|honey|syrup)\b/)) return "Pantry & Grains";
  if (has(/\b(hummus|deli|prepared|entrée|entree|sandwich|burrito|tamale)\b/)) return "Deli & Prepared";
  if (has(/\b(apple|banana|avocado|lettuce|spinach|kale|carrot|broccoli|tomato|potato|onion|garlic|berries|berry|fruit|vegetable|produce)\b/)) return "Produce";
  return "Other Groceries";
}

function imagePathFor(id) {
  for (const extension of ["webp", "png", "jpg", "jpeg"]) {
    if (existsSync(path.join(root, "public/images", `${id}.${extension}`))) return `/images/${id}.${extension}`;
  }
  return "";
}

function localDate(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sizeFromTitle(title) {
  const matches = [...title.matchAll(/\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|g|kg|ml|l|ct|count)\b/gi)];
  return matches.at(-1)?.[0] ?? "";
}

const recordsByProduct = new Map();
for (const record of instacart.records) {
  const group = recordsByProduct.get(record.id) ?? [];
  group.push(record);
  recordsByProduct.set(record.id, group);
}

const acceptedMatches = [...(matchData.allMatches ?? matchData.matches)]
  .sort((a, b) => b.matchScore - a.matchScore || b.matchMargin - a.matchMargin || a.productId.localeCompare(b.productId, undefined, { numeric: true }));
const matchByAsin = new Map();
for (const match of acceptedMatches) if (!matchByAsin.has(match.asin)) matchByAsin.set(match.asin, match);
const safewayMatchByDirectId = new Map(safewayMatches.matches.map((match) => [match.directId, match]));
const qfcMatchByDirectId = new Map(qfcMatches.matches.map((match) => [match.directId, match]));
const instacartAllFourProductIds = new Set(
  [...recordsByProduct.entries()]
    .filter(([, records]) => ["pcc", "metro", "safeway", "qfc"].every((storeId) => records.some((record) => record.storeId === storeId)))
    .map(([productId]) => productId),
);
const wholeFoodsMatchedProductIds = new Set([...matchByAsin.values()].map((match) => match.productId));
const safewayMatchedProductIds = new Set(safewayMatches.matches.map((match) => match.productId));
const qfcMatchedProductIds = new Set(qfcMatches.matches.map((match) => match.productId));
const bothDirectAllFourProductIds = new Set(
  [...instacartAllFourProductIds].filter((productId) => safewayMatchedProductIds.has(productId) && qfcMatchedProductIds.has(productId)),
);
const wholeFoodsAllFourProductIds = new Set(
  [...instacartAllFourProductIds].filter((productId) => wholeFoodsMatchedProductIds.has(productId)),
);

const productsById = new Map();
for (const [id, records] of recordsByProduct) {
  const name = mostCommon(records.map((record) => record.name), `Instacart product ${id}`);
  productsById.set(id, {
    id,
    name,
    size: mostCommon(records.map((record) => record.size)),
    category: classifyProduct(name, records.map((record) => record.category ?? "")),
    priceBasis: mostCommon(records.map((record) => record.priceBasis), "per item"),
    imageUrl: mostCommon(records.map((record) => record.imageUrl)),
    imagePath: imagePathFor(id) || `/images/${id}.webp`,
  });
}

for (const record of wholeFoods.records) {
  if (matchByAsin.has(record.asin)) continue;
  const id = `wf:${record.asin}`;
  productsById.set(id, {
    id,
    name: record.title,
    size: sizeFromTitle(record.title),
    category: classifyProduct(record.title, [record.category ?? ""]),
    priceBasis: "per item",
    imageUrl: record.imageUrl,
    imagePath: "",
  });
}

for (const { prefix, records, matchByDirectId } of [
  { prefix: "safeway", records: safewayDirect.records, matchByDirectId: safewayMatchByDirectId },
  { prefix: "qfc", records: qfcDirect.records, matchByDirectId: qfcMatchByDirectId },
]) {
  for (const record of records) {
    if (matchByDirectId.has(record.id)) continue;
    const id = `${prefix}:${record.id}`;
    productsById.set(id, {
      id,
      name: record.title,
      size: record.size || sizeFromTitle(record.title),
      category: classifyProduct(record.title, [record.category ?? ""]),
      priceBasis: record.priceBasis || "per item",
      imageUrl: record.imageUrl || "",
      imagePath: "",
    });
  }
}

const products = [...productsById.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
const instacartTimestamps = instacart.records.map((record) => new Date(record.capturedAt).toISOString()).sort();
const wholeFoodsTimestamps = wholeFoods.records.map((record) => new Date(record.capturedAt).toISOString()).sort();
const safewayTimestamps = safewayDirect.records.map((record) => new Date(record.capturedAt).toISOString()).sort();
const qfcTimestamps = qfcDirect.records.map((record) => new Date(record.capturedAt).toISOString()).sort();
const instacartStartedAt = instacartTimestamps[0];
const instacartCompletedAt = instacartTimestamps.at(-1);
const wholeFoodsStartedAt = wholeFoodsTimestamps[0];
const wholeFoodsCompletedAt = wholeFoodsTimestamps.at(-1);
const safewayStartedAt = safewayTimestamps[0];
const safewayCompletedAt = safewayTimestamps.at(-1);
const qfcStartedAt = qfcTimestamps[0];
const qfcCompletedAt = qfcTimestamps.at(-1);
const completedAt = [instacartCompletedAt, wholeFoodsCompletedAt, safewayCompletedAt, qfcCompletedAt].sort().at(-1);
const instacartRunId = `instacart-west-seattle-${localDate(instacartStartedAt)}`;
const wholeFoodsRunId = `amazon-whole-foods-west-seattle-${localDate(wholeFoodsStartedAt)}`;
const safewayRunId = `safeway-direct-west-seattle-${localDate(safewayStartedAt)}`;
const qfcRunId = `qfc-direct-west-seattle-${localDate(qfcStartedAt)}`;
const methodology = "Current prices come from four explicit corpora: PCC and Metropolitan Market on Instacart.com, Safeway's direct West Seattle pickup catalog on Safeway.com, QFC's direct West Seattle pickup catalog on QFC.com, and Whole Foods West Seattle pickup on Amazon.com. The lower displayed member, club, or sale price is used when the product card presents it as the current price; the higher regular price is retained separately. Clip-once and buy-multiple coupons are not applied to a one-of-each basket. Instacart identical IDs are joined directly; retailer-specific aliases and every cross-source match require equivalent brand, variant, and package quantity. Ambiguous matches are excluded. Historical Instacart observations for Safeway and QFC remain in SQLite but are never used in the current comparison.";

await rm(databasePath, { force: true });
const database = new DatabaseSync(databasePath);
database.exec(schema);

const insertStore = database.prepare(`
  INSERT INTO stores (id, slug, name, short_name, address, store_url, catalog_source, catalog_url, color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertProduct = database.prepare(`
  INSERT INTO products (id, name, size, category, price_basis, image_source_url, local_image_path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertIdentifier = database.prepare(`
  INSERT OR REPLACE INTO product_identifiers (source, external_id, product_id, source_title, source_size, source_url)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertMatch = database.prepare(`
  INSERT INTO product_matches (source, external_id, product_id, match_method, match_score, match_margin, match_evidence, reviewed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertRun = database.prepare(`
  INSERT INTO capture_runs (id, started_at, completed_at, observation_date, delivery_area, source, methodology)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertObservation = database.prepare(`
  INSERT INTO price_observations (
    run_id, store_id, product_id, source, external_id, observed_at, observation_date,
    price_cents, original_price_cents, on_sale, available, price_basis, product_url,
    captured_url, captured_query, captured_category
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);
const insertQuery = database.prepare(`
  INSERT INTO capture_queries (run_id, store_id, query, category_hint, captured_at, result_count)
  VALUES (?, ?, ?, ?, ?, ?)
`);

database.exec("BEGIN");
try {
  for (const store of stores) insertStore.run(store.id, store.slug, store.name, store.shortName, store.address, store.storeUrl, store.catalogSource, store.catalogUrl, store.color);
  for (const product of products) insertProduct.run(product.id, product.name, product.size, product.category, product.priceBasis, product.imageUrl, product.imagePath);

  insertRun.run(instacartRunId, instacartStartedAt, instacartCompletedAt, localDate(instacartCompletedAt), "West Seattle, Seattle, WA", "Instacart", "Identical Instacart IDs plus conservative same-SKU retailer alias clusters; original external IDs are preserved.");
  insertRun.run(wholeFoodsRunId, wholeFoodsStartedAt, wholeFoodsCompletedAt, localDate(wholeFoodsCompletedAt), "West Seattle, Seattle, WA 98116", "Amazon Whole Foods Market", matchData.methodology);
  insertRun.run(safewayRunId, safewayStartedAt, safewayCompletedAt, localDate(safewayCompletedAt), "2622 California Ave SW, Seattle, WA 98116", "Safeway.com", safewayMatches.methodology);
  insertRun.run(qfcRunId, qfcStartedAt, qfcCompletedAt, localDate(qfcCompletedAt), "4550 42nd Ave SW, Seattle, WA 98116", "QFC.com", qfcMatches.methodology);

  for (const record of instacart.records) {
    insertIdentifier.run("instacart", record.sourceProductId, record.id, record.name, record.size || "", record.productUrl);
    insertObservation.run(
      instacartRunId, record.storeId, record.id, "instacart", record.sourceProductId,
      new Date(record.capturedAt).toISOString(), localDate(record.capturedAt), Math.round(record.price * 100),
      record.originalPrice == null ? null : Math.round(record.originalPrice * 100), record.sale ? 1 : 0,
      record.priceBasis || "per item", record.productUrl, record.capturedUrl || "", record.query || "", record.category || "",
    );
  }

  for (const record of wholeFoods.records) {
    const match = matchByAsin.get(record.asin);
    const productId = match?.productId ?? `wf:${record.asin}`;
    insertIdentifier.run("amazon_whole_foods", record.asin, productId, record.title, sizeFromTitle(record.title), record.productUrl);
    if (match) insertMatch.run("amazon_whole_foods", record.asin, productId, match.matchMethod, match.matchScore, match.matchMargin, match.sizeEvidence, matchData.generatedAt);
    insertObservation.run(
      wholeFoodsRunId, "wholefoods", productId, "amazon_whole_foods", record.asin,
      new Date(record.capturedAt).toISOString(), localDate(record.capturedAt), Math.round(record.price * 100),
      null, 0, "per item", record.productUrl, record.searchUrl || "", record.query || "", record.category || "",
    );
  }

  for (const { storeId, source, prefix, runId, records, matches, matchByDirectId } of [
    {
      storeId: "safeway",
      source: "safeway.com",
      prefix: "safeway",
      runId: safewayRunId,
      records: safewayDirect.records,
      matches: safewayMatches,
      matchByDirectId: safewayMatchByDirectId,
    },
    {
      storeId: "qfc",
      source: "qfc.com",
      prefix: "qfc",
      runId: qfcRunId,
      records: qfcDirect.records,
      matches: qfcMatches,
      matchByDirectId: qfcMatchByDirectId,
    },
  ]) {
    for (const record of records) {
      const match = matchByDirectId.get(record.id);
      const productId = match?.productId ?? `${prefix}:${record.id}`;
      insertIdentifier.run(source, record.id, productId, record.title, record.size || sizeFromTitle(record.title), record.productUrl);
      if (match) insertMatch.run(source, record.id, productId, match.matchMethod, match.matchScore, match.matchMargin, match.sizeEvidence, matches.generatedAt);
      insertObservation.run(
        runId, storeId, productId, source, record.id,
        new Date(record.capturedAt).toISOString(), localDate(record.capturedAt), Math.round(record.price * 100),
        record.originalPrice == null ? null : Math.round(record.originalPrice * 100), record.sale ? 1 : 0,
        record.priceBasis || "per item", record.productUrl, record.capturedUrl || "", record.query || "", record.category || "",
      );
    }
  }

  for (const query of instacart.queries) insertQuery.run(instacartRunId, query.storeId, query.query, query.category || "", new Date(query.capturedAt).toISOString(), query.count || 0);
  for (const query of wholeFoods.queries) insertQuery.run(wholeFoodsRunId, "wholefoods", query.query, query.category || "", new Date(query.capturedAt).toISOString(), query.count || 0);
  for (const query of safewayDirect.queries) insertQuery.run(safewayRunId, "safeway", query.query, query.category || "", new Date(query.capturedAt).toISOString(), query.count ?? query.resultCount ?? 0);
  for (const query of qfcDirect.queries) insertQuery.run(qfcRunId, "qfc", query.query, query.category || "", new Date(query.capturedAt).toISOString(), query.count ?? query.resultCount ?? 0);
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}

const latestRows = database.prepare(`
  SELECT o.*, p.name, p.size, p.category, p.image_source_url, p.local_image_path
  FROM price_observations o
  JOIN products p ON p.id = o.product_id
  WHERE o.available = 1
    AND NOT (o.source = 'instacart' AND o.store_id IN ('safeway', 'qfc'))
  ORDER BY o.observed_at
`).all();

const siteProductsById = new Map();
for (const row of latestRows) {
  const product = siteProductsById.get(row.product_id) ?? {
    id: row.product_id,
    name: row.name,
    size: row.size,
    category: row.category,
    priceBasis: row.price_basis,
    imageUrl: row.image_source_url,
    imagePath: row.local_image_path,
    prices: {},
  };
  product.prices[row.store_id] = {
    price: row.price_cents / 100,
    originalPrice: row.original_price_cents == null ? null : row.original_price_cents / 100,
    sale: Boolean(row.on_sale),
    priceBasis: row.price_basis,
    url: row.product_url,
    source: row.source,
    observedAt: row.observed_at,
  };
  siteProductsById.set(row.product_id, product);
}

const siteProducts = [...siteProductsById.values()]
  .map((product) => ({ ...product, storeCount: Object.keys(product.prices).length }))
  .filter((product) => product.storeCount >= 2)
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const pairwise = [];
for (let first = 0; first < stores.length; first += 1) {
  for (let second = first + 1; second < stores.length; second += 1) {
    const a = stores[first];
    const b = stores[second];
    const shared = siteProducts.filter((product) => product.prices[a.id] && product.prices[b.id]);
    let aWins = 0;
    let bWins = 0;
    let ties = 0;
    let aTotal = 0;
    let bTotal = 0;
    for (const product of shared) {
      const aPrice = product.prices[a.id].price;
      const bPrice = product.prices[b.id].price;
      aTotal += aPrice;
      bTotal += bPrice;
      if (aPrice < bPrice) aWins += 1;
      else if (bPrice < aPrice) bWins += 1;
      else ties += 1;
    }
    pairwise.push({
      stores: [a.id, b.id],
      count: shared.length,
      totals: { [a.id]: Number(aTotal.toFixed(2)), [b.id]: Number(bTotal.toFixed(2)) },
      wins: { [a.id]: aWins, [b.id]: bWins },
      ties,
      cheaperStore: aTotal === bTotal ? null : aTotal < bTotal ? a.id : b.id,
      savings: Number(Math.abs(aTotal - bTotal).toFixed(2)),
      percentDifference: Number((Math.abs(aTotal - bTotal) / Math.max(1, aTotal, bTotal) * 100).toFixed(1)),
    });
  }
}

const storePerformance = stores.map((store) => {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let comparableProducts = 0;
  let relativeIndexTotal = 0;
  for (const product of siteProducts) {
    const own = product.prices[store.id];
    if (!own) continue;
    comparableProducts += 1;
    const available = Object.values(product.prices).map((price) => price.price);
    const mean = available.reduce((sum, price) => sum + price, 0) / available.length;
    relativeIndexTotal += own.price / mean;
    for (const [otherStoreId, other] of Object.entries(product.prices)) {
      if (otherStoreId === store.id) continue;
      if (own.price < other.price) wins += 1;
      else if (own.price > other.price) losses += 1;
      else ties += 1;
    }
  }
  return {
    storeId: store.id,
    comparableProducts,
    matchups: wins + losses + ties,
    wins,
    losses,
    ties,
    winRate: Number((wins / Math.max(1, wins + losses) * 100).toFixed(1)),
    priceIndex: Number((relativeIndexTotal / Math.max(1, comparableProducts) * 100).toFixed(1)),
  };
}).sort((a, b) => a.priceIndex - b.priceIndex);

const categories = [...new Set(siteProducts.map((product) => product.category))]
  .map((category) => ({
    category,
    count: siteProducts.filter((product) => product.category === category).length,
    allStoreCount: siteProducts.filter((product) => product.category === category && product.storeCount === stores.length).length,
  }))
  .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const distribution = Object.fromEntries(stores.map((_, index) => [String(index + 1), siteProducts.filter((product) => product.storeCount === index + 1).length]));
const pricingResearch = {
  updatedAt: "2026-07-17",
  headline: "PCC has the stronger no-markup signal. Metropolitan Market's regular-catalog markup remains unknown.",
  conclusion: "PCC's current storefront says “No markup,” which is strong evidence against a systematic item upcharge. Its detailed policy still describes area-average in-store prices and warns that a particular shelf price or in-store sale can differ. Metropolitan Market's regular storefront says prices may vary and its terms permit different online prices, but neither discloses a percentage. A separate Metropolitan Market Fast storefront is explicitly higher than in-store; that is relevant context, not proof that the same markup applies to the regular catalog used here.",
  verdicts: [
    {
      storeId: "pcc",
      confidence: "High confidence",
      status: "No systematic markup claimed",
      summary: "The best current evidence supports price parity in the practical Instacart sense—not an exact promise that every digital price equals the West Seattle shelf tag at that moment.",
      details: [
        "PCC's current Instacart mobile storefront displays a “No markup” indicator.",
        "The detailed policy says PCC sets the prices and that they reflect average in-store prices in the area; local shelf prices, store-only sales, feed delays, and errors can still create differences.",
        "PCC's Instacart-powered terms reserve the legal right to set different online prices. That broad platform language weakens an absolute shelf-price guarantee, but it does not negate the storefront's current no-markup representation.",
        "We found no credible independent audit or local report that measured a PCC Instacart item markup percentage.",
      ],
      sources: [
        { label: "PCC Instacart storefront", url: "https://www.instacart.com/store/pcc-community-markets/storefront", tier: "Official storefront" },
        { label: "PCC delivery terms", url: "https://delivery.pccmarkets.com/terms", tier: "Official terms" },
        { label: "Instacart pricing-policy definitions", url: "https://docs.instacart.com/catalog/get_started/onboarding", tier: "Platform documentation" },
      ],
    },
    {
      storeId: "metro",
      confidence: "Mixed evidence",
      status: "Regular-catalog markup unknown",
      summary: "Metro clearly allows its online prices to differ, but the evidence does not establish whether the regular West Seattle catalog has a uniform markup—or how large one would be.",
      details: [
        "The regular Metropolitan Market storefront says prices may vary from in-store and provides no percentage.",
        "Its Instacart-powered terms say Metro sets item prices and may vary them from in-store, between storefronts, and across platforms.",
        "The separate “Metropolitan Market Fast” storefront is explicitly labeled higher than in-store. It proves Metro operates at least one marked-up Instacart surface, not that the regular catalog uses the same policy or rate.",
        "Puget Sound Consumers' Checkbook found Metro had the highest delivered total in its sample, but that figure combined groceries, fees, and tip and therefore cannot isolate an item markup.",
      ],
      sources: [
        { label: "Regular Metro Instacart storefront", url: "https://www.instacart.com/store/metropolitan-market/storefront", tier: "Official storefront" },
        { label: "Metropolitan Market terms", url: "https://shop.metropolitan-market.com/terms", tier: "Official terms" },
        { label: "Metropolitan Market Fast storefront", url: "https://www.instacart.com/store/metropolitan-market-fast/storefront", tier: "Official comparison" },
        { label: "Puget Sound Consumers' Checkbook", url: "https://www.checkbook.org/puget-sound-area/supermarkets/articles/Grocery-Delivery-Pros-Cons-and-Costs-of-Having-Someone-Else-Do-Your-Shopping-7136", tier: "Independent basket study" },
      ],
    },
  ],
  directAudit: [
    {
      storeId: "safeway",
      comparedProducts: safewayMatches.markupSummary.comparedProducts,
      instacartHigherCount: safewayMatches.markupSummary.instacartHigherCount,
      directHigherCount: safewayMatches.markupSummary.directHigherCount,
      samePriceCount: safewayMatches.markupSummary.samePriceCount,
      totalInstacart: safewayMatches.markupSummary.totalInstacart,
      totalDirect: safewayMatches.markupSummary.totalDirect,
      basketDifference: Number((safewayMatches.markupSummary.totalInstacart - safewayMatches.markupSummary.totalDirect).toFixed(2)),
      basketPercent: Number(((safewayMatches.markupSummary.totalInstacart / safewayMatches.markupSummary.totalDirect - 1) * 100).toFixed(1)),
      medianDifference: safewayMatches.markupSummary.medianDifference,
    },
    {
      storeId: "qfc",
      comparedProducts: qfcMatches.markupSummary.comparedProducts,
      instacartHigherCount: qfcMatches.markupSummary.instacartHigherCount,
      directHigherCount: qfcMatches.markupSummary.directHigherCount,
      samePriceCount: qfcMatches.markupSummary.samePriceCount,
      totalInstacart: qfcMatches.markupSummary.totalInstacart,
      totalDirect: qfcMatches.markupSummary.totalDirect,
      basketDifference: Number((qfcMatches.markupSummary.totalInstacart - qfcMatches.markupSummary.totalDirect).toFixed(2)),
      basketPercent: Number(((qfcMatches.markupSummary.totalInstacart / qfcMatches.markupSummary.totalDirect - 1) * 100).toFixed(1)),
      medianDifference: qfcMatches.markupSummary.medianDifference,
    },
  ],
  context: [
    {
      title: "What the labels mean",
      body: "Instacart's current retailer documentation defines “Everyday Store Prices” as no markup, “Higher than in-store” as a standard markup, and “Other” as markup on selected items. Retailers—not Instacart—set the item prices.",
      sources: [
        { label: "Instacart retailer onboarding", url: "https://docs.instacart.com/catalog/get_started/onboarding" },
        { label: "Instacart consumer terms", url: "https://www.instacart.com/terms/" },
      ],
    },
    {
      title: "What the broader controversy tells us",
      body: "A 2025 investigation found that some shoppers saw different test prices for the same item. Instacart ended that testing program; retailers can still set different online and location-specific prices. That history is a reason to date this corpus, not evidence of a PCC- or Metro-specific percentage.",
      sources: [
        { label: "AP report on the ended price tests", url: "https://apnews.com/article/instacart-pricing-customers-retailers-c9a0a52e959ce46d2152aa664308d228" },
      ],
    },
    {
      title: "What blogs and Reddit add",
      body: "Local discussions repeatedly characterize Metro—and sometimes PCC—as expensive stores, and one self-described Metro employee discussed high retail margins. Those posts concern underlying store prices and product mix, not the Instacart-versus-shelf delta. General posts claiming a universal 10–25% Instacart markup are not reliable for these two retailer-set catalogs.",
      sources: [
        { label: "Seattle discussion of PCC base prices", url: "https://www.reddit.com/r/Seattle/comments/u6r2vw/why_are_prices_so_high_at_pcc/" },
        { label: "Seattle discussion of Metro base prices", url: "https://www.reddit.com/r/Seattle/comments/s2oajq/why_do_people_shop_at_the_metropolitan_market/" },
      ],
    },
  ],
  limitations: [
    "This project has no same-minute in-store shelf audit for PCC or Metropolitan Market, so it cannot calculate either store's actual Instacart markup.",
    "Comparing PCC or Metro with direct Safeway, QFC, and Whole Foods prices measures the final online prices a shopper sees; it does not separate a store's base-price level from any marketplace markup.",
    "Sales, loyalty prices, weighted-item estimates, fulfillment mode, feed delays, and location differences can all move an individual price.",
  ],
};
const siteData = {
  metadata: {
    runId: `${instacartRunId}+${wholeFoodsRunId}+${safewayRunId}+${qfcRunId}`,
    capturedAt: completedAt,
    capturedAtLabel: dateFormatter.format(new Date(completedAt)),
    captureStartedAt: [instacartStartedAt, wholeFoodsStartedAt, safewayStartedAt, qfcStartedAt].sort()[0],
    deliveryArea: "West Seattle, Seattle, WA",
    methodology,
    caveat: "Catalog prices can differ from in-store shelf prices, vary by fulfillment method, and change at any time. Displayed member, club, and sale prices are used. Clip-once digital coupons and quantity-dependent offers are excluded from the one-of-each baskets.",
    locationNote: "PCC and Metropolitan Market use Instacart catalogs for the selected West Seattle delivery area. Safeway and QFC use direct pickup prices from the listed West Seattle stores. Amazon was set to Seattle 98116 with Whole Foods West Seattle selected for pickup.",
  },
  stores,
  summary: {
    capturedProducts: products.length,
    observationCount: instacart.records.length + wholeFoods.records.length + safewayDirect.records.length + qfcDirect.records.length,
    currentObservationCount: latestRows.length,
    comparableProducts: siteProducts.length,
    allStoreProducts: siteProducts.filter((product) => product.storeCount === stores.length).length,
    storeCount: stores.length,
    distribution,
    queryCount: instacart.queries.length + wholeFoods.queries.length + safewayDirect.queries.length + qfcDirect.queries.length,
    acceptedCrossSourceMatches: matchByAsin.size,
    instacartAllFourProducts: instacartAllFourProductIds.size,
    bothDirectAllFourProducts: bothDirectAllFourProductIds.size,
    wholeFoodsAllFourProducts: wholeFoodsAllFourProductIds.size,
    directCatalogProducts: {
      safeway: safewayDirect.records.length,
      qfc: qfcDirect.records.length,
      wholefoods: wholeFoods.records.length,
    },
    directReplacements: {
      safeway: safewayMatches.matches.length,
      qfc: qfcMatches.matches.length,
    },
  },
  pricingResearch,
  storePerformance,
  pairwise,
  categories,
  products: siteProducts,
};

await writeFile(siteDataPath, `${JSON.stringify(siteData, null, 2)}\n`);
await writeFile(publicSiteDataPath, JSON.stringify(siteData));
database.close();

console.log(JSON.stringify({
  database: path.relative(root, databasePath),
  siteData: path.relative(root, siteDataPath),
  products: products.length,
  observations: siteData.summary.observationCount,
  comparableProducts: siteProducts.length,
  allStoreProducts: siteData.summary.allStoreProducts,
  acceptedWholeFoodsMatches: siteData.summary.acceptedCrossSourceMatches,
  acceptedSafewayDirectMatches: safewayMatches.matches.length,
  acceptedQfcDirectMatches: qfcMatches.matches.length,
  pairwise: pairwise.map((pair) => ({ stores: pair.stores.join(" / "), count: pair.count })),
}, null, 2));
