# West Seattle Grocery Index analysis

Prices were captured July 16–17, 2026 for a West Seattle delivery area. PCC, Metropolitan Market, Safeway, and QFC came from Instacart; Whole Foods came from Amazon with the West Seattle store selected.

## Coverage

- 33,925 distinct captured products after same-SKU identity reconciliation
- 46,055 dated price observations
- 8,100 products comparable at two or more stores
- 1,778 products present at three stores
- 475 products present at four stores
- 181 products present at all five stores
- 810 accepted Whole Foods cross-source matches
- 1,323 recorded search and aisle-capture queries across the two catalog sources

The strict five-store target of more than 300 products was not attainable from the live catalogs with same-SKU matching. The capture now covers every food aisle exposed by all four Instacart stores (excluding alcohol), reconciles only high-confidence duplicate Instacart IDs, records exact Whole Foods search-result provenance, and automatically excludes borderline cross-source candidates. That exhaustive pass produced 181 defensible unique five-way matches. Similar flavors, sizes, multipacks, or product variants were excluded.

## Pairwise baskets

Each row is a one-of-each basket over the products shared by that pair. Totals should not be compared between rows because every pair has a different product set.

| Pair | Matches | Lower basket | Difference |
|---|---:|---|---:|
| PCC vs. Metropolitan Market | 2,200 | PCC | $1,883.63 (11.1%) |
| PCC vs. Safeway | 973 | PCC | $1,340.52 (18.0%) |
| PCC vs. QFC | 994 | PCC | $1,094.14 (14.5%) |
| PCC vs. Whole Foods | 537 | PCC | $11.85 (0.3%) |
| Metropolitan Market vs. Safeway | 2,559 | Metropolitan Market | $965.39 (5.1%) |
| Metropolitan Market vs. QFC | 2,465 | Metropolitan Market | $490.23 (2.8%) |
| Metropolitan Market vs. Whole Foods | 539 | Whole Foods | $335.98 (8.4%) |
| Safeway vs. QFC | 4,570 | QFC | $777.12 (2.3%) |
| Safeway vs. Whole Foods | 409 | Whole Foods | $645.66 (19.7%) |
| QFC vs. Whole Foods | 414 | Whole Foods | $465.51 (14.7%) |

## Overall store pattern

The site uses a product-level price index to summarize uneven catalogs. For each comparable product, 100 is the average among stores where that product was captured; each store's index is the mean of those product-level ratios. Lower is cheaper.

| Store | Price index | Head-to-head win rate | Comparable products |
|---|---:|---:|---:|
| PCC Community Markets | 92.8 | 79.6% | 2,713 |
| Whole Foods Market | 93.0 | 76.2% | 810 |
| QFC | 100.9 | 47.3% | 5,600 |
| Metropolitan Market | 101.3 | 47.2% | 4,689 |
| Safeway | 102.5 | 31.5% | 5,659 |

Whole Foods still has a smaller comparable set, so its overall index is not directly as representative as the four Instacart stores. On its broader 537-product pairing with PCC, PCC is cheaper by just $11.85 (0.3%). On the strict 181-product basket shared by all five, totals are:

| Store | Total |
|---|---:|
| Whole Foods Market | $1,155.78 |
| PCC Community Markets | $1,178.17 |
| Metropolitan Market | $1,262.06 |
| QFC | $1,360.89 |
| Safeway | $1,450.55 |

Whole Foods is $294.77 below Safeway on that fully common basket. PCC is second, $22.39 above Whole Foods.

## Category breadth

The strict five-store set spans 14 categories. Dairy and eggs is largest with 48 products, followed by bakery and bread (21), baking (16), plant-based foods (14), condiments and oils (14), breakfast and cereal (14), snacks (12), meat and seafood (11), beverages (10), frozen (8), canned goods and soup (7), pasta and sauces (3), other groceries (2), and produce (1). The site exposes every category and dynamically recalculates strict baskets for the selected stores.

## Method and caveats

Every SQLite observation includes an observation date and timestamp, store, source, original external product ID, canonical product ID, price, sale state, source URL, and capture query. `product_identifiers` and `product_matches` preserve the identity evidence needed for future historical updates. Amazon query records now retain the ASIN result set from each exact search.

Catalog prices can differ from in-store shelf prices, vary by address, and change at any time. The addresses on the site provide West Seattle context; the catalog source, not the address alone, determines the displayed price and availability.
