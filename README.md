# West Seattle Grocery Index

An interactive public comparison of PCC Community Markets, Metropolitan Market, Safeway, QFC, and Whole Foods Market using a July 16–18, 2026 West Seattle price snapshot.

The current corpus contains **3,552 products found at two or more stores** and **31,591 dated price observations** from the price sources used by the comparison. Of those, **867 products appear at three or more stores**, including **207 four-store products** and **64 products found at all five stores**. The corpus includes **603 accepted Whole Foods cross-source matches**, and every two-store pairing has at least **161 exact products** in common. The site supports any subset of stores, device-local shopping baskets with quantities and complete-store total ranking, pairwise and strict shared baskets, conservative catalog-claim filters for gluten-free and other diets, category filters, product thumbnails, price-source links, and CSV export.

Diet filters match explicit wording in captured catalog titles. The gluten-free filter intentionally excludes naturally gluten-free foods without a visible claim and reminds celiac shoppers to verify the current package label, ingredients, and cross-contact information before buying.

Live site: <https://west-seattle-grocery-prices.jubishop.chatgpt.site/#top>

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:3000/#top>.

## Data pipeline

- `data/capture-checkpoint.json` is the durable Instacart browser capture for PCC, Metropolitan Market, Safeway, and QFC.
- `data/instacart-weight-details.json` retains live product-detail unit rates, estimated each totals, and displayed average weights for verified variable-weight Instacart products.
- `data/whole-foods-capture-checkpoint.json` is the durable Amazon Whole Foods capture.
- `data/whole-foods-matches.json` is the generated conservative cross-source product crosswalk.
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

Audit the generated pricing modes, exclusions, basis consistency, and weighted-price regression:

```bash
npm run data:audit-pricing
```

## SQLite model

The schema separates stable `stores` and `products` from source-specific `product_identifiers`, audited `product_matches`, dated `capture_runs`, row-level `price_observations`, and `capture_queries`. Every observation records its source, external product ID, observation date and timestamp, store, current and original prices, promotion state, price basis, pricing mode, estimated item-price and weight provenance when applicable, comparison eligibility, exclusion reason, product URL, and capture query. Obsolete Safeway and QFC Instacart prices are excluded; their identifiers and query evidence remain for crosswalk auditing, and the direct-match artifacts preserve aggregate markup statistics. Future snapshots can be inserted as additional capture runs for historical price analysis.

## Store context

- PCC Community Markets: 2749 California Ave SW, Seattle, WA 98116
- Metropolitan Market: 2320 42nd Ave SW, Seattle, WA 98116
- Safeway: 2622 California Ave SW, Seattle, WA 98116
- QFC: 4550 42nd Ave SW, Seattle, WA 98116
- Whole Foods Market: 4755 Fauntleroy Way SW Ste 190, Seattle, WA 98116

The PCC and Metropolitan Market Instacart catalogs use the selected West Seattle delivery area. Safeway and QFC use the direct pickup catalogs for the listed West Seattle stores. Amazon was set to Seattle 98116 with Whole Foods West Seattle selected for pickup.

## Price and matching methodology

Current displayed prices are used, including member, club, and sale prices when shown; original prices are retained separately. For products marked “Final cost by weight,” the explicit unit rate is canonicalized to dollars per pound. The estimated each total and displayed average weight remain provenance only. A URL ending in `/each` or `1-lb` is never accepted as proof of selling basis. Legacy variable-weight candidates without a verified rate remain in SQLite but are ineligible for comparisons, and a final automatic gate prevents any canonical product from mixing price bases. Clip-once digital coupons and buy-multiple offers are not applied to the comparison baskets.

The Instacart catalogs are joined by identical product ID or a conservative same-SKU alias supported by equivalent brand, numeric variant, package quantity, and protected product claims; every original external ID is retained. Whole Foods and direct-store products are linked automatically and conservatively by brand, product or flavor tokens, equivalent package quantity, and agreement on protected variants. Loose produce additionally requires the same normalized produce name, variety, organic status, and selling basis. Loose raw meat and seafood require the same normalized cut and an explicitly captured per-pound basis plus agreement on organic, grass-fed, pasture-raised, free-range, air-chilled, wild/farmed, bone, skin, frozen, lean-percentage, grade, Angus, heritage, antibiotic, natural, rib-meat, value-pack, and retained-water claims. Poultry also requires product-detail qualifier evidence on both sides. Ambiguous candidates are excluded automatically.

The requested 300-item strict five-store intersection has not yet been reached: the current exact-product corpus contains 64 defensible unique five-way matches. The site reports that shortfall directly and does not pad it with merely similar or unit-incompatible products.
