import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = new DatabaseSync(path.join(root, "data/grocery-prices.sqlite"), { readOnly: true });

try {
  const pricingModes = database.prepare(`
    SELECT source, store_id, pricing_mode, COUNT(*) AS rows
    FROM price_observations
    GROUP BY source, store_id, pricing_mode
    ORDER BY source, store_id, pricing_mode
  `).all();
  const exclusions = database.prepare(`
    SELECT exclusion_reason, COUNT(*) AS rows
    FROM price_observations
    WHERE comparison_eligible = 0
    GROUP BY exclusion_reason
    ORDER BY exclusion_reason
  `).all();
  const mixedEligibleProducts = database.prepare(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT product_id
      FROM price_observations
      WHERE available = 1
        AND comparison_eligible = 1
      GROUP BY product_id
      HAVING COUNT(DISTINCT price_basis) > 1
    )
  `).get().count;
  const eligibleUnverifiedWeights = database.prepare(`
    SELECT COUNT(*) AS count
    FROM price_observations
    WHERE comparison_eligible = 1
      AND pricing_mode = 'unverified_variable_weight'
  `).get().count;
  const celeryRoot = database.prepare(`
    SELECT store_id, price_cents, price_basis, pricing_mode,
           estimated_item_price_cents, estimated_weight_lb
    FROM price_observations
    WHERE source = 'instacart'
      AND external_id = '16383572'
    ORDER BY store_id
  `).all();

  const audit = {
    pricingModes,
    exclusions,
    mixedEligibleProducts,
    eligibleUnverifiedWeights,
    celeryRoot,
  };
  if (mixedEligibleProducts || eligibleUnverifiedWeights) {
    throw new Error(`Unsafe pricing rows remain:\n${JSON.stringify(audit, null, 2)}`);
  }
  console.log(JSON.stringify(audit, null, 2));
} finally {
  database.close();
}
