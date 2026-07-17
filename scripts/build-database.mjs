import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpointPath = path.join(root, "data/capture-checkpoint.json");
const schemaPath = path.join(root, "data/schema.sql");
const databasePath = path.join(root, "data/grocery-prices.sqlite");
const siteDataPath = path.join(root, "data/site-data.json");

const capture = JSON.parse(await readFile(checkpointPath, "utf8"));
const schema = await readFile(schemaPath, "utf8");

const stores = [
  {
    id: "pcc",
    slug: "pcc-community-markets",
    name: "PCC Community Markets",
    shortName: "PCC",
    address: "2749 California Ave SW, Seattle, WA 98116",
    storeUrl: "https://www.pccmarkets.com/stores/west-seattle/",
    instacartUrl: "https://www.instacart.com/store/pcc-community-markets",
    color: "#216247",
  },
  {
    id: "metro",
    slug: "metropolitan-market",
    name: "Metropolitan Market",
    shortName: "Metro",
    address: "2320 42nd Ave SW, Seattle, WA 98116",
    storeUrl: "https://metropolitan-market.com/locations/",
    instacartUrl: "https://www.instacart.com/store/metropolitan-market",
    color: "#7f3b4d",
  },
  {
    id: "safeway",
    slug: "safeway",
    name: "Safeway",
    shortName: "Safeway",
    address: "2622 California Ave SW, Seattle, WA 98116",
    storeUrl: "https://local.safeway.com/safeway/wa/seattle/2622-california-ave-sw.html",
    instacartUrl: "https://www.instacart.com/store/safeway",
    color: "#b3262e",
  },
  {
    id: "qfc",
    slug: "qfc",
    name: "QFC",
    shortName: "QFC",
    address: "4550 42nd Ave SW, Seattle, WA 98116",
    storeUrl: "https://www.qfc.com/stores/grocery/wa/seattle/west-seattle/705/00883",
    instacartUrl: "https://www.instacart.com/store/qfc",
    color: "#315b96",
  },
];

const storeById = new Map(stores.map((store) => [store.id, store]));
const recordsByProduct = new Map();
for (const record of capture.records) {
  const group = recordsByProduct.get(record.id) ?? [];
  group.push(record);
  recordsByProduct.set(record.id, group);
}

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
  return `/images/${id}.webp`;
}

const products = [...recordsByProduct.entries()].map(([id, records]) => {
  const name = mostCommon(records.map((record) => record.name), `Instacart product ${id}`);
  const size = mostCommon(records.map((record) => record.size));
  const priceBasis = mostCommon(records.map((record) => record.priceBasis), "per item");
  const imageUrl = mostCommon(records.map((record) => record.imageUrl));
  return {
    id,
    name,
    size,
    category: classifyProduct(name, records.map((record) => record.category ?? "")),
    priceBasis,
    imageUrl,
    imagePath: imagePathFor(id),
  };
}).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const productById = new Map(products.map((product) => [product.id, product]));
const timestamps = capture.records.map((record) => new Date(record.capturedAt).toISOString()).sort();
const startedAt = timestamps[0];
const completedAt = timestamps.at(-1);
const runId = `instacart-seattle-${startedAt.slice(0, 10)}`;
const methodology = "Prices are current displayed Instacart prices for one Seattle delivery area. Products are matched only by identical Instacart product ID; sale prices are included when shown.";

await rm(databasePath, { force: true });
const database = new DatabaseSync(databasePath);
database.exec(schema);

const insertStore = database.prepare(`
  INSERT INTO stores (id, slug, name, short_name, address, store_url, instacart_url, color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertProduct = database.prepare(`
  INSERT INTO products (id, name, size, category, price_basis, image_source_url, local_image_path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertRun = database.prepare(`
  INSERT INTO capture_runs (id, started_at, completed_at, delivery_area, source, methodology)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertObservation = database.prepare(`
  INSERT INTO price_observations (
    run_id, store_id, product_id, observed_at, price_cents, original_price_cents,
    on_sale, available, price_basis, product_url, captured_url, captured_query, captured_category
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);
const insertQuery = database.prepare(`
  INSERT INTO capture_queries (run_id, store_id, query, category_hint, captured_at, result_count)
  VALUES (?, ?, ?, ?, ?, ?)
`);

database.exec("BEGIN");
try {
  for (const store of stores) insertStore.run(store.id, store.slug, store.name, store.shortName, store.address, store.storeUrl, store.instacartUrl, store.color);
  for (const product of products) insertProduct.run(product.id, product.name, product.size, product.category, product.priceBasis, product.imageUrl, product.imagePath);
  insertRun.run(runId, startedAt, completedAt, "Seattle, WA", "Instacart", methodology);
  for (const record of capture.records) {
    insertObservation.run(
      runId,
      record.storeId,
      record.id,
      new Date(record.capturedAt).toISOString(),
      Math.round(record.price * 100),
      record.originalPrice == null ? null : Math.round(record.originalPrice * 100),
      record.sale ? 1 : 0,
      record.priceBasis || "per item",
      record.productUrl,
      record.capturedUrl || "",
      record.query || "",
      record.category || "",
    );
  }
  for (const query of capture.queries) {
    insertQuery.run(runId, query.storeId, query.query, query.category || "", new Date(query.capturedAt).toISOString(), query.count || 0);
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}

const latestRows = database.prepare(`
  SELECT o.*, p.name, p.size, p.category, p.image_source_url, p.local_image_path
  FROM price_observations o
  JOIN products p ON p.id = o.product_id
  WHERE o.run_id = ? AND o.available = 1
`).all(runId);

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
      percentDifference: Number((Math.abs(aTotal - bTotal) / Math.max(aTotal, bTotal) * 100).toFixed(1)),
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
    allFourCount: siteProducts.filter((product) => product.category === category && product.storeCount === 4).length,
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

const siteData = {
  metadata: {
    runId,
    capturedAt: completedAt,
    capturedAtLabel: dateFormatter.format(new Date(completedAt)),
    captureStartedAt: startedAt,
    deliveryArea: "Seattle, WA",
    methodology,
    caveat: "Instacart prices can differ from in-store shelf prices, vary by delivery address, and change at any time. Loyalty-only discounts were not substituted for the regular displayed price.",
    locationNote: "Instacart identifies the delivery catalog, not the fulfilling branch. These are the nearby West Seattle store addresses used for local context.",
  },
  stores,
  summary: {
    capturedProducts: products.length,
    observationCount: capture.records.length,
    comparableProducts: siteProducts.length,
    allFourProducts: siteProducts.filter((product) => product.storeCount === 4).length,
    threeStoreProducts: siteProducts.filter((product) => product.storeCount === 3).length,
    twoStoreProducts: siteProducts.filter((product) => product.storeCount === 2).length,
    queryCount: capture.queries.length,
  },
  storePerformance,
  pairwise,
  categories,
  products: siteProducts,
};

await writeFile(siteDataPath, `${JSON.stringify(siteData, null, 2)}\n`);
database.close();

console.log(JSON.stringify({
  database: path.relative(root, databasePath),
  siteData: path.relative(root, siteDataPath),
  products: products.length,
  observations: capture.records.length,
  comparableProducts: siteProducts.length,
  allFourProducts: siteData.summary.allFourProducts,
  pairwise: pairwise.map((pair) => ({ stores: pair.stores.join(" / "), count: pair.count })),
}, null, 2));
