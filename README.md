# West Seattle Grocery Index

An interactive public comparison of PCC Community Markets, Metropolitan Market, Safeway, QFC, and Whole Foods Market using a July 16–17, 2026 West Seattle price snapshot.

The current corpus contains **3,748 products found at two or more stores** and **58,038 dated price observations**. The strict intersection contains **189 products found at all five stores**, while **770 accepted Whole Foods cross-source matches** make pairwise and subset comparisons substantially broader. The site supports any subset of stores, device-local shopping baskets with quantities and complete-store total ranking, pairwise and strict shared baskets, category filters, product thumbnails, price-source links, and CSV export.

Live site: <https://west-seattle-grocery-prices.jubishop.chatgpt.site/#top>

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:3000/#top>.

## Data pipeline

- `data/capture-checkpoint.json` is the durable Instacart browser capture for PCC, Metropolitan Market, Safeway, and QFC.
- `data/whole-foods-capture-checkpoint.json` is the durable Amazon Whole Foods capture.
- `data/whole-foods-matches.json` is the generated conservative cross-source product crosswalk.
- `data/whole-foods-match-overrides.json` is the small auditable list of human-reviewed same-SKU matches.
- `data/instacart-aliases.json` records high-confidence retailer-specific Instacart ID aliases for diagnostics.
- `data/schema.sql` defines the historical-ready relational schema.
- `data/grocery-prices.sqlite` is the populated SQLite database committed with the site.
- `data/site-data.json` is the generated five-store payload used by the app.
- `data/products.csv` and `public/west-seattle-grocery-prices.csv` contain the comparable products in wide CSV form.
- `public/images/` contains downloaded thumbnails from the earlier PCC/Metro capture; newer products use their captured source image URLs.
- `data/products.json` is the original 298-item PCC/Metro snapshot retained as a legacy source artifact.

Rebuild the match data, SQLite database, site payload, and CSV:

```bash
npm run data:build
```

## SQLite model

The schema separates stable `stores` and `products` from source-specific `product_identifiers`, audited `product_matches`, dated `capture_runs`, row-level `price_observations`, and `capture_queries`. Every observation records its source, external product ID, observation date and timestamp, store, current and original prices, promotion state, price basis, product URL, and capture query. Future snapshots can be inserted as additional capture runs for historical price analysis.

## Store context

- PCC Community Markets: 2749 California Ave SW, Seattle, WA 98116
- Metropolitan Market: 2320 42nd Ave SW, Seattle, WA 98116
- Safeway: 2622 California Ave SW, Seattle, WA 98116
- QFC: 4550 42nd Ave SW, Seattle, WA 98116
- Whole Foods Market: 4755 Fauntleroy Way SW Ste 190, Seattle, WA 98116

The four Instacart catalogs use the selected West Seattle delivery area. Amazon was set to Seattle 98116 with Whole Foods West Seattle selected for pickup. Catalog selection does not guarantee fulfillment from a particular branch.

## Price and matching methodology

Current displayed prices are used, including member, club, and sale prices when shown; original prices are retained separately. Clip-once digital coupons and buy-multiple offers are not applied to the one-of-each comparison baskets.

The four Instacart retailers are joined by identical product ID or a conservative same-SKU alias supported by equivalent brand, package quantity, and explicit organic, gluten-free, non-GMO, and plant-based claims; every original external ID is retained. Whole Foods and direct-store products are linked conservatively by brand, product or flavor tokens, equivalent package quantity, and agreement on organic and gluten-free variants, while non-GMO and plant-based descriptors remain part of the name score. A July 17 matching audit separated protected product variants, and an audited override file admits only human-reviewed same-SKU title variations. Ambiguous matches are excluded.

The requested 300-item strict five-store intersection has not yet been reached: the current exact-product corpus contains 189 defensible unique five-way matches. The site reports that shortfall directly and does not pad it with merely similar products.
