# PCC vs. Metropolitan Market

Price snapshot captured from Instacart on July 16, 2026 at 3:56 PM PDT for delivery in Seattle, WA.

## Result

Across 298 exact product matches, a one-of-each basket costs **$1,991.88 at PCC** and **$2,217.04 at Metropolitan Market**. PCC is **$225.16 cheaper (10.2%)**.

- PCC is cheaper on 235 items.
- Metropolitan Market is cheaper on 51 items.
- 12 items are tied.
- The median individual item is 10.3% cheaper at PCC.
- Removing all 55 rows with a displayed sale at either store leaves 243 regular-price rows. PCC is still $216.15 cheaper and wins 213 of those rows.

## Category totals

| Category | Items | PCC | Metro | Lower total |
|---|---:|---:|---:|---|
| Dairy & Eggs | 55 | $324.95 | $354.35 | PCC by $29.40 |
| Snacks | 51 | $275.59 | $304.35 | PCC by $28.76 |
| Pantry | 49 | $320.81 | $365.31 | PCC by $44.50 |
| Beverages | 37 | $246.65 | $240.55 | Metro by $6.10 |
| Bakery & Bread | 24 | $172.76 | $191.66 | PCC by $18.90 |
| Sauces & Condiments | 22 | $255.08 | $279.48 | PCC by $24.40 |
| Breakfast | 15 | $107.65 | $129.65 | PCC by $22.00 |
| Frozen Foods | 13 | $74.77 | $92.97 | PCC by $18.20 |
| Baking | 12 | $100.48 | $125.28 | PCC by $24.80 |
| Plant Proteins | 8 | $27.90 | $34.70 | PCC by $6.80 |
| Meat & Deli | 6 | $63.94 | $75.14 | PCC by $11.20 |
| Produce | 6 | $21.30 | $23.60 | PCC by $2.30 |

PCC has the lower total in 11 of 12 categories. Beverages are the exception, driven partly by Metro's lower prices on several Tony's Coffee and Spindrift products.

## Method

Products are matched by exact Instacart product ID, with names and sizes verified across both stores. Current displayed prices are compared for the same delivery address. The displayed sale price is used when a promotion is active and the original price is retained in the dataset. Weighted produce is compared at the displayed per-pound rate; every other row compares one listed unit.

This is a point-in-time Instacart comparison, not a claim about in-store shelf prices. Prices and availability can vary by address, fulfillment method, promotion, and time.

Every row is available in `data/products.csv` and `data/products.json`; all 298 captured thumbnails are stored under `public/images/`.
