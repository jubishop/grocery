# Four-store Seattle grocery price analysis

Price observations were captured from Instacart on July 16, 2026 for one Seattle delivery area. Products are matched only when the Instacart product ID is identical.

## Coverage

- 3,835 distinct products captured
- 5,900 dated store-price observations
- 1,381 products present at two or more stores
- 334 products present at three stores
- 175 products present at all four stores
- 1,381 local product thumbnails, with no download failures

Every two-store pairing clears the requested 300-item floor:

| Pair | Exact matches | Lower one-of-each basket | Difference |
|---|---:|---|---:|
| PCC vs. Metropolitan Market | 692 | PCC | $428.01 (9.1%) |
| PCC vs. Safeway | 349 | PCC | $439.55 (16.8%) |
| PCC vs. QFC | 357 | PCC | $365.35 (14.3%) |
| Metropolitan Market vs. Safeway | 452 | Metropolitan Market | $300.23 (8.4%) |
| Metropolitan Market vs. QFC | 457 | Metropolitan Market | $189.17 (5.7%) |
| Safeway vs. QFC | 617 | QFC | $80.69 (1.6%) |

The pairwise totals use one of every exact shared product for that pair. They are deliberately not compared across different pairs because each pair has a different basket.

## Overall store pattern

To summarize stores across uneven catalogs, the site uses a product-level price index. For each comparable product, 100 is the average price among stores where that product was captured; the store index is the mean of those product-level ratios. Lower is cheaper.

| Store | Price index | Head-to-head win rate | Comparable products |
|---|---:|---:|---:|
| PCC Community Markets | 92.9 | 81.7% | 824 |
| Metropolitan Market | 100.2 | 49.0% | 974 |
| QFC | 102.9 | 38.2% | 827 |
| Safeway | 103.9 | 29.9% | 821 |

PCC leads this snapshot by both normalized price index and head-to-head wins. Metropolitan Market is second overall and has the lower exact-match basket against both Safeway and QFC. QFC narrowly leads Safeway on their 617-item shared basket.

The strict 175-product basket stocked by all four totals:

| Store | Total |
|---|---:|
| PCC Community Markets | $1,100.80 |
| Metropolitan Market | $1,169.44 |
| QFC | $1,269.65 |
| Safeway | $1,297.14 |

On that fully common basket, PCC is $196.34 below Safeway, the highest total.

## Category breadth

The comparable corpus spans dairy and eggs, beverages, baking, frozen foods, snacks, plant-based foods, bakery and bread, pasta and sauces, canned goods and soup, condiments and oils, meat and seafood, breakfast and cereal, pantry and grains, and produce. Dairy is the largest category because several cross-chain yogurt, cheese, egg, and alternative-milk searches were used to raise overlap, but the site exposes category filters and strict shared category baskets rather than presenting the data as one homogeneous sample.

## Method and caveats

Current displayed prices are used, including displayed promotions; original prices are retained separately. Loyalty-only discounts were not substituted for the regular displayed price. Each SQLite observation includes its time, store, product, price, sale state, source URL, and capture query.

Instacart prices can differ from in-store shelf prices, vary by delivery address, and change at any time. Instacart identifies the delivery catalog, not the guaranteed fulfillment branch. Nearby West Seattle store addresses are included only as local context, while the delivery area is disclosed as Seattle, WA.

The strict all-four intersection is 175 products, not 300. The 300-product guarantee applies to every possible **two-store comparison**. The site reports both numbers explicitly and lets users require availability at every selected store when comparing three or four stores.
