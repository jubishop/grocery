# West Seattle Grocery Index

An interactive public site backed by a July 16, 2026 Instacart snapshot of PCC Community Markets, Metropolitan Market, Safeway, and QFC in West Seattle.

The main corpus contains **1,381 products found at two or more stores**, matched by identical Instacart product ID. Every two-store pairing has at least 349 exact matches; 334 products appear at three stores and 175 appear at all four.

Live site: <https://west-seattle-grocery-prices.jubishop.chatgpt.site/#top>

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:3000/#top>.

## Data pipeline

- `data/capture-checkpoint.json` is the durable raw browser capture: 3,835 distinct products and 5,900 store-price rows.
- `data/schema.sql` defines the historical-ready relational schema.
- `data/grocery-prices.sqlite` is the populated SQLite database committed with the site.
- `data/site-data.json` is the generated four-store payload used by the app.
- `data/products.csv` and `public/west-seattle-grocery-prices.csv` contain the 1,381 comparable products in wide CSV form.
- `public/images/` contains one local thumbnail for every comparable product.
- `data/products.json` is the original 298-item PCC/Metro snapshot retained as a legacy source artifact.

Rebuild the database, site payload, and CSV:

```bash
npm run data:build
```

Re-fetch any missing local thumbnails:

```bash
npm run images
```

## SQLite model

The schema separates stable `stores` and `products` from dated `capture_runs`, row-level `price_observations`, and `capture_queries`. Each observation records its timestamp, store, product ID, current and original prices, promotion flag, price basis, source URL, and capture query. Future snapshots can be inserted as additional capture runs without changing the product model.

## Store context

- PCC Community Markets: 2749 California Ave SW, Seattle, WA 98116
- Metropolitan Market: 2320 42nd Ave SW, Seattle, WA 98116
- Safeway: 2622 California Ave SW, Seattle, WA 98116
- QFC: 4550 42nd Ave SW, Seattle, WA 98116

Instacart exposes a delivery catalog rather than a guaranteed fulfillment branch. The West Seattle addresses are included for geographic context; the captured delivery area is identified as West Seattle, Seattle, WA.

## Price methodology

Products are exact Instacart product-ID matches. Current displayed prices are used, including promotions when shown; original prices are retained separately. Loyalty-only discounts are not substituted for the regular displayed price. The snapshot is not a claim about current in-store shelf prices, and Instacart prices or availability may vary by address and time.
