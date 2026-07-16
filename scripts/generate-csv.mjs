import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(path.join(root, "data/products.json"), "utf8"));

const columns = [
  ["instacart_product_id", "id"],
  ["product", "name"],
  ["size", "size"],
  ["category", "category"],
  ["price_basis", "priceBasis"],
  ["pcc_price", "pccPrice"],
  ["metropolitan_market_price", "metroPrice"],
  ["pcc_original_price", "pccOriginal"],
  ["metropolitan_market_original_price", "metroOriginal"],
  ["winner", "winner"],
  ["metro_minus_pcc", "difference"],
  ["percent_difference_vs_metro", "percentDifference"],
  ["pcc_instacart_url", "pccUrl"],
  ["metropolitan_market_instacart_url", "metroUrl"],
  ["local_image", "imagePath"],
  ["source_image_url", "imageUrl"],
];

function cell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const lines = [
  columns.map(([heading]) => heading).join(","),
  ...data.items.map((item) => columns.map(([, key]) => cell(item[key])).join(",")),
];
const csv = `${lines.join("\n")}\n`;

await writeFile(path.join(root, "data/products.csv"), csv);
await writeFile(path.join(root, "public/pcc-vs-metro-prices.csv"), csv);
console.log(`Wrote ${data.items.length} rows to data/products.csv and public/pcc-vs-metro-prices.csv`);

