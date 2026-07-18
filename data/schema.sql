PRAGMA foreign_keys = ON;

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  address TEXT NOT NULL,
  store_url TEXT NOT NULL,
  catalog_source TEXT NOT NULL,
  catalog_url TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price_basis TEXT NOT NULL DEFAULT 'per item',
  image_source_url TEXT NOT NULL DEFAULT '',
  local_image_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_identifiers (
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  source_title TEXT NOT NULL DEFAULT '',
  source_size TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (source, external_id)
);

CREATE TABLE product_matches (
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  match_method TEXT NOT NULL,
  match_score REAL,
  match_margin REAL,
  match_evidence TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (source, external_id, product_id)
);

CREATE TABLE capture_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  delivery_area TEXT NOT NULL,
  source TEXT NOT NULL,
  methodology TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_observations (
  run_id TEXT NOT NULL REFERENCES capture_runs(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  original_price_cents INTEGER CHECK (original_price_cents IS NULL OR original_price_cents >= 0),
  on_sale INTEGER NOT NULL DEFAULT 0 CHECK (on_sale IN (0, 1)),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  price_basis TEXT NOT NULL DEFAULT 'per item',
  product_url TEXT NOT NULL,
  captured_url TEXT NOT NULL DEFAULT '',
  captured_query TEXT NOT NULL DEFAULT '',
  captured_category TEXT NOT NULL DEFAULT '',
  comparison_eligible INTEGER NOT NULL DEFAULT 1 CHECK (comparison_eligible IN (0, 1)),
  exclusion_reason TEXT NOT NULL DEFAULT '',
  pricing_mode TEXT NOT NULL DEFAULT 'fixed_price',
  estimated_item_price_cents INTEGER CHECK (estimated_item_price_cents IS NULL OR estimated_item_price_cents >= 0),
  estimated_weight_lb REAL CHECK (estimated_weight_lb IS NULL OR estimated_weight_lb > 0),
  PRIMARY KEY (run_id, store_id, external_id)
);

CREATE TABLE capture_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES capture_runs(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  query TEXT NOT NULL,
  category_hint TEXT NOT NULL DEFAULT '',
  captured_at TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX price_observations_product_date
  ON price_observations (product_id, observation_date DESC, observed_at DESC);
CREATE INDEX price_observations_store_date
  ON price_observations (store_id, observation_date DESC, observed_at DESC);
CREATE INDEX price_observations_run_store
  ON price_observations (run_id, store_id);
CREATE INDEX product_identifiers_product
  ON product_identifiers (product_id);
CREATE INDEX product_matches_product
  ON product_matches (product_id);
CREATE INDEX capture_queries_run_store
  ON capture_queries (run_id, store_id);
