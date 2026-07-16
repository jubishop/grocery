import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(path.join(root, "data/products.json"), "utf8"));
const outputDir = path.join(root, "public/images");
await mkdir(outputDir, { recursive: true });

const queue = [...data.items];
let downloaded = 0;
let skipped = 0;
const failures = [];

async function existsAndHasData(filename) {
  try {
    return (await stat(filename)).size > 100;
  } catch {
    return false;
  }
}

async function download(item) {
  const filename = path.join(root, "public", item.imagePath);
  if (await existsAndHasData(filename)) {
    skipped += 1;
    return;
  }

  const temporary = `${filename}.part`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(item.imageUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
          Referer: "https://www.instacart.com/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) throw new Error(`Unexpected content type: ${contentType}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 100) throw new Error(`Image too small: ${bytes.byteLength} bytes`);
      await writeFile(temporary, bytes);
      await rename(temporary, filename);
      downloaded += 1;
      return;
    } catch (error) {
      await rm(temporary, { force: true });
      if (attempt === 3) failures.push({ id: item.id, error: error.message });
      else await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

async function worker() {
  while (queue.length) {
    const item = queue.shift();
    await download(item);
  }
}

await Promise.all(Array.from({ length: 10 }, worker));

console.log(JSON.stringify({ downloaded, skipped, failures }, null, 2));
if (failures.length) process.exitCode = 1;

