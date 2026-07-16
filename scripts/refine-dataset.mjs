import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filename = path.join(root, "data/products.json");
const data = JSON.parse(await readFile(filename, "utf8"));

function categorize(item) {
  const name = item.name.toLowerCase();
  const source = item.source.toLowerCase();

  if (/\b(cauliflower|bananas?|red onion)\b/.test(name) || source === "produce") return "Produce";
  if (/\b(tofu|plant based|plant-based)\b/.test(name) || source === "tofu") return "Plant Proteins";
  if (/\b(sausage|bacon|turkey|chicken breast|salami|pepperoni|hot dog|meatball)\b/.test(name) || source === "applegate") return "Meat & Deli";
  if (/\b(bread|bagels?|english muffins?|buns?|rolls?)\b/.test(name) || source === "dave's killer bread") return "Bakery & Bread";
  if (/\b(frozen|pizza)\b/.test(name) || ["frozen pizza", "frozen vegetables", "frozen"].includes(source)) return "Frozen Foods";
  if (/\b(coffee|tea|kombucha|soda|sparkling|water|latte|beverage|drink|tepache)\b/.test(name) || ["coffee", "tea", "kombucha", "spindrift", "san pellegrino", "beverages"].includes(source)) return "Beverages";
  if (/\b(chips?|crackers?|popcorn|chocolate|cookies?|pretzels?|snack|bars?)\b/.test(name) || ["simple mills", "siete", "crackers", "popcorn", "chocolate", "granola bars"].includes(source)) return "Snacks";
  if (/\b(cereal|granola|oatmeal|muesli|waffles?|pancake)\b/.test(name) || ["nature's path", "cascadian farm"].includes(source)) return "Breakfast";
  if (/\b(flour|sugar|baking|cornmeal)\b/.test(name) || ["flour", "sugar", "bob's red mill"].includes(source)) return "Baking";
  if (/\b(sauce|dressing|mayo|mayonnaise|mustard|ketchup|oil|vinegar|salsa)\b/.test(name) || ["primal kitchen", "rao's", "olive oil"].includes(source)) return "Sauces & Condiments";
  if (/\b(peanut|almond|hazelnut|cashew|sunflower) butter\b/.test(name) || /\bpsyllium\b/.test(name) || source === "peanut butter") return "Pantry";
  if (/\b(eggs?|butter|yogurt|kefir|milk|cheese|cheddar|cream|skyr)\b/.test(name) || ["siggi's", "chobani", "oatly", "califia farms", "tillamook", "vital farms", "organic valley"].includes(source)) return "Dairy & Eggs";
  return "Pantry";
}

function sum(items, key) {
  return Number(items.reduce((total, item) => total + item[key], 0).toFixed(2));
}

for (const item of data.items) item.category = categorize(item);
data.items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

const groups = Object.groupBy(data.items, (item) => item.category);
data.categories = Object.entries(groups)
  .map(([category, items]) => {
    const pccTotal = sum(items, "pccPrice");
    const metroTotal = sum(items, "metroPrice");
    const difference = Number((metroTotal - pccTotal).toFixed(2));
    return {
      category,
      count: items.length,
      pccTotal,
      metroTotal,
      difference,
      percentDifference: Number(((difference / metroTotal) * 100).toFixed(1)),
      pccWins: items.filter((item) => item.winner === "PCC").length,
      metroWins: items.filter((item) => item.winner === "Metropolitan Market").length,
      ties: items.filter((item) => item.winner === "Tie").length,
      winner: difference > 0 ? "PCC" : difference < 0 ? "Metropolitan Market" : "Tie",
    };
  })
  .sort((a, b) => b.count - a.count);

await writeFile(filename, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify(data.categories, null, 2));

