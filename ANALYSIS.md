# West Seattle Grocery Index analysis

Prices were captured July 16–18, 2026 for West Seattle. PCC and Metropolitan Market prices come from Instacart, Safeway and QFC prices come from their direct pickup catalogs, and Whole Foods prices come from Amazon with the West Seattle store selected.

## Coverage

- 41,241 distinct captured products after identity reconciliation
- 31,591 dated price observations retained in SQLite
- 30,518 observations eligible for current comparisons
- 1,073 unverified variable-weight observations retained but excluded
- 3,552 products comparable at two or more stores
- 596 products present at three stores
- 207 products present at four stores
- 64 products present at all five stores
- 603 accepted Whole Foods cross-source matches
- 2,909 recorded search and aisle-capture queries

The strict five-store target of more than 300 products is not attainable from this snapshot under same-product, same-basis matching. Similar flavors, sizes, packages, protected product claims, and incompatible or unverified selling bases are excluded automatically.

## Weight normalization audit

Instacart can show a retailer-specific estimated each total even when the final cost is calculated by weight. The pipeline now parses the explicit unit rate and canonicalizes it to dollars per pound; the estimate and displayed average weight are retained only as provenance. Direct-store card text such as `$4.93 each ($3.79 / Lb)` is normalized by the same rule. Packaged bags and other fixed-size products retain their each price.

The current SQLite audit reports:

- 22 eligible Instacart unit-price observations across PCC and Metro
- 34 eligible direct-store per-pound observations across Safeway and QFC, including 16 Safeway final-cost-by-weight estimates
- 1,073 excluded unverified variable-weight observations
- zero eligible products mixing selling bases
- zero unverified weight prices eligible for comparison

The reported celery-root regression is now PCC **$2.99/lb** versus Metro **$4.19/lb**. The former estimated totals—$5.98 for an assumed 2.0 lb at PCC and $0.38 for an assumed 0.09 lb at Metro—remain stored as evidence but no longer affect rankings.

## Pairwise baskets

Each row is a one-unit basket over the products shared by that pair. A unit is one item for fixed-price products and one pound for per-pound products. Totals should not be compared between rows because every pair has a different product set.

| Pair | Matches | Lower basket | Difference |
|---|---:|---|---:|
| PCC vs. Metropolitan Market | 2,153 | PCC | $1,902.99 (11.4%) |
| PCC vs. Safeway | 325 | PCC | $106.19 (4.9%) |
| PCC vs. QFC | 424 | QFC | $63.12 (2.3%) |
| PCC vs. Whole Foods | 400 | PCC | $30.55 (1.2%) |
| Metropolitan Market vs. Safeway | 717 | Safeway | $415.41 (8.8%) |
| Metropolitan Market vs. QFC | 929 | QFC | $850.73 (13.2%) |
| Metropolitan Market vs. Whole Foods | 379 | Whole Foods | $266.93 (9.8%) |
| Safeway vs. QFC | 680 | QFC | $142.20 (3.5%) |
| Safeway vs. Whole Foods | 161 | Whole Foods | $103.01 (9.7%) |
| QFC vs. Whole Foods | 187 | QFC | $12.53 (1.1%) |

## Overall store pattern

The site uses a product-level price index to summarize uneven catalogs. For each comparable product, 100 is the average among stores where that product was captured; each store's index is the mean of those ratios. Lower is cheaper.

| Store | Price index | Head-to-head win rate | Comparable products |
|---|---:|---:|---:|
| QFC | 94.6 | 72.1% | 1,285 |
| PCC Community Markets | 95.5 | 72.1% | 2,387 |
| Whole Foods Market | 96.6 | 68.5% | 562 |
| Safeway | 98.7 | 46.6% | 1,033 |
| Metropolitan Market | 106.9 | 18.5% | 3,039 |

Whole Foods has a smaller comparable set, so its overall index is less representative than PCC or Metro. On the strict 64-product basket shared by all five stores, totals are:

| Store | Total |
|---|---:|
| QFC | $385.90 |
| Whole Foods Market | $386.44 |
| PCC Community Markets | $401.56 |
| Safeway | $432.85 |
| Metropolitan Market | $440.09 |

## Category breadth

The strict five-store set spans 12 categories: dairy and eggs (22), bakery and bread (11), baking (7), breakfast and cereal (5), snacks (4), frozen (3), condiments and oils (3), meat and seafood (2), beverages (2), canned goods and soup (2), plant-based foods (2), and pasta and sauces (1).

## Method and caveats

Every SQLite observation includes an observation timestamp and date, store, source, original external product ID, canonical product ID, comparison and estimated-item price evidence, sale state, selling basis, pricing mode, eligibility, exclusion reason, source URL, and capture query. `product_identifiers` and `product_matches` preserve the identity evidence needed for future historical updates.

Catalog prices can differ from in-store shelf prices, vary by address and fulfillment mode, and change at any time. The addresses on the site provide West Seattle context; the catalog source, not the address alone, determines displayed price and availability.
