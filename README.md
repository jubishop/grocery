# PCC vs. Metropolitan Market grocery price comparison

An interactive ChatGPT Site backed by a July 16, 2026 Instacart snapshot of 298 exact product matches at PCC Community Markets and Metropolitan Market in Seattle.

Store locations: PCC Community Markets — West Seattle, 2749 California Ave SW, Seattle, WA 98116; and Metropolitan Market — West Seattle (Admiral), 2320 42nd Ave SW, Seattle, WA 98116. The delivery location is disclosed only as Seattle, WA.

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Data and assets

- `data/products.json` is the canonical structured dataset, including summary statistics and category totals.
- `data/products.csv` contains all 298 item-level comparisons.
- `public/images/` contains one locally downloaded thumbnail per matched product.
- `ANALYSIS.md` records the headline findings and methodology.

Rebuild the CSV download with `npm run data:csv`. Re-fetch images from the recorded source URLs with `npm run images`.

## Price methodology

Products are exact Instacart product-ID matches, captured for the same delivery address. Current displayed prices are used, including promotions when shown. Weighted produce is normalized to the displayed per-pound rate. The snapshot is not a substitute for current in-store shelf pricing.
