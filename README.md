# West Seattle Grocery Index

An interactive public catalog and strict price comparison for PCC Community Markets, Metropolitan Market, Safeway, QFC, and Whole Foods Market, plus the complete published Trader Joe's web catalog with a separate commodity-matching overlay, using a July 16–18, 2026 West Seattle price snapshot.

The current SQLite corpus retains **52,191 product identities** and **42,713 dated price observations**. The website and CSV expose all **37,107 products with a current retained price**: **31,984** have one comparison-eligible store, **1,004 catalog-only products** have an ambiguous selling unit and remain excluded from comparisons, and **4,119 strict products** appear at two or more compatible stores. Of the comparable set, **1,017 products appear at three or more stores**, and **89 products are confirmed across all five core stores**. The corpus includes **711 accepted Whole Foods cross-source matches**, and every core two-store pairing has at least **197 exact products** in common.

Trader Joe's is reported separately: all **1,678 captured product records** from every page of its published web catalog are searchable, **185 plain commodities** pass the automatic eligibility gate, and **14** have strict matches to at least one core store. Trader Joe's notes that its website does not represent every physical-store product. Its private-label and prepared inventory remains in the raw/searchable catalog but does not dilute the core-five coverage metric.

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
- `data/trader-joes-capture-checkpoint.json` contains every priced card across all 112 pages of TraderJoes.com's published all-products catalog with Seattle store 157 selected.
- `data/trader-joes-matches.json` records the automatic plain-commodity eligibility gate and strict accepted Trader Joe's crosswalk.
- `data/instacart-aliases.json` records high-confidence retailer-specific Instacart ID aliases for diagnostics.
- `data/schema.sql` defines the historical-ready relational schema.
- `data/grocery-prices.sqlite` is the populated SQLite database committed with the site.
- `data/site-data.json` is the generated five-core-store plus Trader Joe's overlay payload used by the app.
- `public/site-data.json` is the browser manifest; `public/site-data-products/` contains the same searchable catalog in bounded product chunks so the full corpus can be hosted without trimming.
- `data/products.csv` and `public/west-seattle-grocery-prices.csv` contain every current searchable product in wide CSV form; unmatched stores remain blank.
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

The schema separates stable `stores` and `products` from source-specific `product_identifiers`, audited `product_matches`, dated `capture_runs`, row-level `price_observations`, and `capture_queries`. Every valid captured item—including house brands, exclusives, and single-store products—is retained. Comparison eligibility is a separate property and never controls raw catalog retention. Every observation records its source, external product ID, observation date and timestamp, store, current and original prices, promotion state, price basis, pricing mode, estimated item-price and weight provenance when applicable, comparison eligibility, exclusion reason, product URL, and capture query. Obsolete Safeway and QFC Instacart prices are excluded; their identifiers and query evidence remain for crosswalk auditing, and the direct-match artifacts preserve aggregate markup statistics. Covering indices support current-comparison, source-ID, product-date, store-date, run-store, and store-query access paths. Future snapshots can be inserted as additional capture runs for historical price analysis.

## Store context

- PCC Community Markets: 2749 California Ave SW, Seattle, WA 98116
- Metropolitan Market: 2320 42nd Ave SW, Seattle, WA 98116
- Safeway: 2622 California Ave SW, Seattle, WA 98116
- QFC: 4550 42nd Ave SW, Seattle, WA 98116
- Whole Foods Market: 4755 Fauntleroy Way SW Ste 190, Seattle, WA 98116
- Trader Joe's: 4545 Fauntleroy Way SW, Seattle, WA 98116

The PCC and Metropolitan Market Instacart catalogs use the selected West Seattle delivery area. Safeway and QFC use the direct pickup catalogs for the listed West Seattle stores. Amazon was set to Seattle 98116 with Whole Foods West Seattle selected for pickup. TraderJoes.com was captured with Seattle store 157 selected; Trader Joe's explicitly notes that its website does not represent every store product.

## Price and matching methodology

Current displayed prices are used, including member, club, and sale prices when shown; original prices are retained separately. For products marked “Final cost by weight,” the explicit unit rate is canonicalized to dollars per pound. The estimated each total and displayed average weight remain provenance only. A URL ending in `/each` or `1-lb` is never accepted as proof of selling basis. Legacy variable-weight candidates without a verified rate remain in SQLite but are ineligible for comparisons, and a final automatic gate prevents any canonical product from mixing price bases. Clip-once digital coupons and buy-multiple offers are not applied to the comparison baskets.

The Instacart catalogs are joined by identical product ID or a conservative same-SKU alias supported by equivalent brand, numeric variant, package quantity, and protected product claims; every original external ID is retained. Whole Foods and direct-store products are linked automatically and conservatively by brand, product or flavor tokens, equivalent package quantity, and agreement on protected variants. Loose produce additionally requires the same normalized produce name, variety, organic status, and selling basis. Loose raw meat and seafood require the same normalized cut and an explicitly captured per-pound basis plus agreement on organic, grass-fed, pasture-raised, free-range, air-chilled, wild/farmed, bone, skin, frozen, lean-percentage, grade, Angus, heritage, antibiotic, natural, rib-meat, value-pack, and retained-water claims. Poultry also requires product-detail qualifier evidence on both sides.

Trader Joe's is handled separately. Prepared, seasoned, mixed, novelty, and private-label-exclusive records remain in the database and searchable catalog but are rejected before cross-store matching. Plain produce requires the same normalized variety, organic state, selling basis, and exact fixed package quantity when packaged. Raw meat requires the same cut, per-pound basis, and protected claims. Eggs, dairy, baking staples, beans, grains, oils, salt, and plain cheese require an exact controlled commodity signature and compatible package quantity. All decisions are automatic; unmatched or ambiguous candidates remain catalog-only.

The requested 300-item strict five-store intersection has not yet been reached: the current exact-product corpus contains 89 defensible unique five-way matches. The site reports that shortfall directly and does not pad it with merely similar or unit-incompatible products.
