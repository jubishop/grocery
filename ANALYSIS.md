# West Seattle Grocery Index analysis

Prices were captured on July 16, 2026 for a West Seattle delivery area. PCC, Metropolitan Market, Safeway, and QFC came from Instacart; Whole Foods came from Amazon with the West Seattle store selected.

## Coverage

- 11,062 distinct captured products
- 15,146 dated price observations
- 2,712 products comparable at two or more stores
- 663 products present at three stores
- 182 products present at four stores
- 115 products present at all five stores
- 617 recorded search queries across the two catalog sources

The strict five-store target of more than 300 products was not attainable from the live catalogs with exact-product matching. After expanding the four-store Instacart corpus, reconciling high-confidence duplicate Instacart IDs, searching every outstanding four-store product on Whole Foods, and manually reviewing borderline cross-source candidates, 115 defensible same-SKU five-way matches remained. Similar flavors, sizes, or product variants were excluded.

## Pairwise baskets

Each row is a one-of-each basket over the exact products shared by that pair. Totals should not be compared between rows because every pair has a different product set.

| Pair | Matches | Lower basket | Difference |
|---|---:|---|---:|
| PCC vs. Metropolitan Market | 1,102 | PCC | $725.84 (9.6%) |
| PCC vs. Safeway | 589 | PCC | $770.59 (17.8%) |
| PCC vs. QFC | 580 | PCC | $579.57 (14.2%) |
| PCC vs. Whole Foods | 115 | PCC | $25.77 (3.7%) |
| Metropolitan Market vs. Safeway | 945 | Metropolitan Market | $583.40 (8.1%) |
| Metropolitan Market vs. QFC | 913 | Metropolitan Market | $340.23 (5.1%) |
| Metropolitan Market vs. Whole Foods | 115 | Whole Foods | $43.85 (6.0%) |
| Safeway vs. QFC | 1,394 | QFC | $328.99 (3.1%) |
| Safeway vs. Whole Foods | 115 | Whole Foods | $147.57 (17.7%) |
| QFC vs. Whole Foods | 115 | Whole Foods | $100.45 (12.7%) |

## Overall store pattern

The site uses a product-level price index to summarize uneven catalogs. For each comparable product, 100 is the average among stores where that exact product was captured; each store's index is the mean of those product-level ratios. Lower is cheaper.

| Store | Price index | Head-to-head win rate | Comparable products |
|---|---:|---:|---:|
| PCC Community Markets | 92.4 | 82.0% | 1,309 |
| Whole Foods Market | 93.6 | 78.2% | 115 |
| Metropolitan Market | 99.9 | 50.9% | 1,781 |
| QFC | 101.8 | 40.6% | 1,785 |
| Safeway | 104.2 | 26.6% | 1,806 |

Whole Foods has a much smaller comparable set, so its overall index is not directly as representative as the four Instacart stores. On the strict 115-product basket shared by all five, totals are:

| Store | Total |
|---|---:|
| PCC Community Markets | $662.73 |
| Whole Foods Market | $688.50 |
| Metropolitan Market | $732.35 |
| QFC | $788.95 |
| Safeway | $836.07 |

PCC is $173.34 below Safeway on that fully common basket. Whole Foods is second, $25.77 above PCC.

## Category breadth

The strict five-store set spans dairy and eggs, bakery and bread, breakfast and cereal, beverages, plant-based foods, baking, frozen foods, snacks, meat and seafood, condiments and oils, canned goods and soup, pasta and sauces, and other groceries. Dairy and eggs is the largest strict category with 29 products; the site exposes every category and dynamically recalculates strict baskets for the selected stores.

## Method and caveats

Every SQLite observation includes an observation date and timestamp, store, source, external product ID, price, sale state, source URL, and capture query. `product_identifiers` and `product_matches` preserve the cross-source identity evidence needed for future updates.

Catalog prices can differ from in-store shelf prices, vary by address, and change at any time. The addresses on the site provide West Seattle context; the catalog source, not the address alone, determines the displayed price and availability.
