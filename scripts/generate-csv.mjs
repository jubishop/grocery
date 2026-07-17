import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(path.join(root, "data/site-data.json"), "utf8"));

const columns = [
  ["instacart_product_id", "id"],
  ["product", "name"],
  ["size", "size"],
  ["category", "category"],
  ["price_basis", "priceBasis"],
  ["stores_available", "storeCount"],
  ["local_image", "imagePath"],
  ["source_image_url", "imageUrl"],
];

for (const store of data.stores) {
  columns.push([`${store.id}_price`, `prices.${store.id}.price`]);
  columns.push([`${store.id}_original_price`, `prices.${store.id}.originalPrice`]);
  columns.push([`${store.id}_sale`, `prices.${store.id}.sale`]);
  columns.push([`${store.id}_instacart_url`, `prices.${store.id}.url`]);
}

function cell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const lines = [
  columns.map(([heading]) => heading).join(","),
  ...data.products.map((item) => columns.map(([, key]) => {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    return cell(value);
  }).join(",")),
];
const csv = `${lines.join("\n")}\n`;

await writeFile(path.join(root, "data/products.csv"), csv);
await writeFile(path.join(root, "public/west-seattle-grocery-prices.csv"), csv);
console.log(`Wrote ${data.products.length} rows to data/products.csv and public/west-seattle-grocery-prices.csv`);
