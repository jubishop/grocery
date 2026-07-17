"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

type StoreId = "pcc" | "metro" | "safeway" | "qfc" | "wholefoods";

type Store = {
  id: StoreId;
  slug: string;
  name: string;
  shortName: string;
  address: string;
  storeUrl: string;
  catalogSource: string;
  catalogUrl: string;
  sourceType: string;
  platformNote: string;
  pricingPolicyTitle: string;
  pricingPolicySummary: string;
  pricingPolicyUrl: string;
  termsUrl: string;
  markupContextUrl: string;
  researchUrl: string;
  color: string;
};

type Price = {
  price: number;
  originalPrice: number | null;
  sale: boolean;
  priceBasis: string;
  url: string;
  source: string;
  observedAt: string;
};

type Product = {
  id: string;
  name: string;
  size: string;
  category: string;
  priceBasis: string;
  imageUrl: string;
  imagePath: string;
  storeCount: number;
  prices: Partial<Record<StoreId, Price>>;
};

type PairSummary = {
  stores: [StoreId, StoreId];
  count: number;
  totals: Partial<Record<StoreId, number>>;
  wins: Partial<Record<StoreId, number>>;
  ties: number;
  cheaperStore: StoreId | null;
  savings: number;
  percentDifference: number;
};

type ResearchSource = {
  label: string;
  url: string;
  tier?: string;
};

export type Dataset = {
  metadata: {
    runId: string;
    capturedAt: string;
    capturedAtLabel: string;
    captureStartedAt: string;
    deliveryArea: string;
    methodology: string;
    caveat: string;
    locationNote: string;
  };
  stores: Store[];
  summary: {
    capturedProducts: number;
    observationCount: number;
    currentObservationCount: number;
    comparableProducts: number;
    allStoreProducts: number;
    storeCount: number;
    distribution: Record<string, number>;
    queryCount: number;
    acceptedCrossSourceMatches: number;
    instacartAllFourProducts: number;
    bothDirectAllFourProducts: number;
    wholeFoodsAllFourProducts: number;
    directCatalogProducts: {
      safeway: number;
      qfc: number;
      wholefoods: number;
    };
    directReplacements: {
      safeway: number;
      qfc: number;
    };
  };
  pricingResearch: {
    updatedAt: string;
    headline: string;
    conclusion: string;
    verdicts: Array<{
      storeId: "pcc" | "metro";
      confidence: string;
      status: string;
      summary: string;
      details: string[];
      sources: ResearchSource[];
    }>;
    directAudit: Array<{
      storeId: "safeway" | "qfc";
      comparedProducts: number;
      instacartHigherCount: number;
      directHigherCount: number;
      samePriceCount: number;
      totalInstacart: number;
      totalDirect: number;
      basketDifference: number;
      basketPercent: number;
      medianDifference: number;
    }>;
    context: Array<{
      title: string;
      body: string;
      sources: ResearchSource[];
    }>;
    limitations: string[];
  };
  storePerformance: Array<{
    storeId: StoreId;
    comparableProducts: number;
    matchups: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    priceIndex: number;
  }>;
  pairwise: PairSummary[];
  categories: Array<{ category: string; count: number; allStoreCount: number }>;
  products: Product[];
};

type SortKey = "spread" | "name" | "category" | "lowest-price";
type WinnerFilter = "all" | "tie" | StoreId;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const integer = new Intl.NumberFormat("en-US");
const priceSourceLabels: Record<string, { label: string; action: string }> = {
  instacart: { label: "Instacart.com", action: "View catalog price" },
  "safeway.com": { label: "Safeway.com", action: "View direct price" },
  "qfc.com": { label: "QFC.com", action: "View direct price" },
  amazon_whole_foods: { label: "Amazon.com", action: "View pickup price" },
};

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15">
      <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function productPrices(product: Product, selected: StoreId[]) {
  return selected.flatMap((storeId) => {
    const price = product.prices[storeId];
    return price ? [{ storeId, ...price }] : [];
  });
}

function spreadFor(product: Product, selected: StoreId[]) {
  const prices = productPrices(product, selected).map((entry) => entry.price);
  return prices.length < 2 ? 0 : Math.max(...prices) - Math.min(...prices);
}

function lowestStores(product: Product, selected: StoreId[]) {
  const prices = productPrices(product, selected);
  if (!prices.length) return [];
  const minimum = Math.min(...prices.map((entry) => entry.price));
  return prices.filter((entry) => entry.price === minimum).map((entry) => entry.storeId);
}

function ProductCard({ product, stores, selected }: { product: Product; stores: Store[]; selected: StoreId[] }) {
  const available = productPrices(product, selected);
  const winners = lowestStores(product, selected);
  const spread = spreadFor(product, selected);
  const winnerLabel = winners.length === available.length
    ? "Same price"
    : winners.length > 1
      ? `${winners.map((id) => stores.find((store) => store.id === id)?.shortName).join(" + ")} tie`
      : `${stores.find((store) => store.id === winners[0])?.shortName} is lowest`;

  return (
    <article className="product-card">
      <div className="product-main">
        <div className="product-image-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="product-image"
            src={product.imagePath || product.imageUrl}
            alt=""
            loading="lazy"
            width="96"
            height="96"
            onError={(event) => {
              if (event.currentTarget.src !== product.imageUrl) event.currentTarget.src = product.imageUrl;
              else event.currentTarget.style.visibility = "hidden";
            }}
          />
        </div>
        <div className="product-copy">
          <div className="product-kicker">
            <span>{product.category}</span>
            <span>{product.storeCount} stores</span>
          </div>
          <h3>{product.name}</h3>
          <p>{product.size || product.priceBasis}</p>
        </div>
      </div>

      <div className="product-prices" style={{ "--selected-count": selected.length } as React.CSSProperties}>
        {selected.map((storeId) => {
          const store = stores.find((entry) => entry.id === storeId)!;
          const price = product.prices[storeId];
          if (!price) {
            return (
              <div className="store-price unavailable-price" key={storeId}>
                <span>{store.shortName}</span>
                <strong>Not captured</strong>
              </div>
            );
          }
          return (
            <a
              className={`store-price ${winners.includes(storeId) ? "lowest-price" : ""}`}
              href={price.url}
              target="_blank"
              rel="noreferrer"
              key={storeId}
              style={{ "--store-color": store.color } as React.CSSProperties}
            >
              <span>{store.shortName}</span>
              <div><strong>{money.format(price.price)}</strong>{price.originalPrice !== null && <s>{money.format(price.originalPrice)}</s>}</div>
              <small className="price-source">{price.sale ? "sale shown · " : ""}{priceSourceLabels[price.source]?.label ?? price.source}</small>
              <small>{priceSourceLabels[price.source]?.action ?? "View source"} ↗</small>
            </a>
          );
        })}
      </div>

      <div className="product-result">
        <span>{winnerLabel}</span>
        <strong>{spread > 0 ? `${money.format(spread)} spread` : "Exact tie"}</strong>
      </div>
    </article>
  );
}

export default function GroceryExplorer({ data }: { data: Dataset }) {
  const [selected, setSelected] = useState<StoreId[]>(data.stores.map((store) => store.id));
  const [requireAll, setRequireAll] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [winner, setWinner] = useState<WinnerFilter>("all");
  const [saleOnly, setSaleOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("spread");
  const [visibleCount, setVisibleCount] = useState(48);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const storeMap = useMemo(() => new Map(data.stores.map((store) => [store.id, store])), [data.stores]);

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = targetId ? document.getElementById(targetId) : document.getElementById("top");
    window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: "auto", block: "start" }));
  }, []);

  useEffect(() => setVisibleCount(48), [selected, requireAll, deferredQuery, category, winner, saleOnly, sort]);

  const allSelectedProducts = useMemo(() => data.products.filter((product) => {
    const count = selected.filter((storeId) => product.prices[storeId]).length;
    if (selected.length === 1) return count === 1;
    return requireAll ? count === selected.length : count >= 2;
  }), [data.products, selected, requireAll]);

  const strictCommonProducts = useMemo(() => data.products.filter((product) => selected.every((storeId) => product.prices[storeId])), [data.products, selected]);

  const filtered = useMemo(() => {
    const items = allSelectedProducts.filter((product) => {
      const searchText = `${product.name} ${product.size} ${product.category}`.toLowerCase();
      const matchesSearch = !deferredQuery || searchText.includes(deferredQuery);
      const matchesCategory = category === "All categories" || product.category === category;
      const selectedPrices = productPrices(product, selected);
      const matchesSale = !saleOnly || selectedPrices.some((entry) => entry.sale);
      const lowest = lowestStores(product, selected);
      const matchesWinner = winner === "all" || (winner === "tie" ? lowest.length > 1 : lowest.length === 1 && lowest[0] === winner);
      return matchesSearch && matchesCategory && matchesSale && matchesWinner;
    });
    return items.sort((a, b) => {
      if (sort === "spread") return spreadFor(b, selected) - spreadFor(a, selected) || a.name.localeCompare(b.name);
      if (sort === "lowest-price") {
        const aMinimum = Math.min(...productPrices(a, selected).map((entry) => entry.price));
        const bMinimum = Math.min(...productPrices(b, selected).map((entry) => entry.price));
        return aMinimum - bMinimum || a.name.localeCompare(b.name);
      }
      if (sort === "category") return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [allSelectedProducts, category, deferredQuery, saleOnly, selected, sort, winner]);

  const basketTotals = useMemo(() => Object.fromEntries(selected.map((storeId) => [
    storeId,
    strictCommonProducts.reduce((total, product) => total + product.prices[storeId]!.price, 0),
  ])) as Record<StoreId, number>, [selected, strictCommonProducts]);

  const basketRanking = [...selected].sort((a, b) => basketTotals[a] - basketTotals[b]);
  const basketLeader = basketRanking[0];
  const basketSavings = basketRanking.length > 1 ? basketTotals[basketRanking.at(-1)!] - basketTotals[basketLeader] : 0;
  const selectedPairs = data.pairwise.filter((pair) => pair.stores.every((storeId) => selected.includes(storeId)));
  const minimumPairCount = Math.min(...data.pairwise.map((pair) => pair.count));
  const bestPerformance = data.storePerformance[0];

  const dynamicCategories = useMemo(() => {
    const names = [...new Set(strictCommonProducts.map((product) => product.category))];
    return names.map((name) => {
      const products = strictCommonProducts.filter((product) => product.category === name);
      const totals = Object.fromEntries(selected.map((storeId) => [
        storeId,
        products.reduce((sum, product) => sum + product.prices[storeId]!.price, 0),
      ])) as Record<StoreId, number>;
      const leader = [...selected].sort((a, b) => totals[a] - totals[b])[0];
      return { name, count: products.length, totals, leader };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [selected, strictCommonProducts]);

  function toggleStore(storeId: StoreId) {
    setSelected((current) => current.includes(storeId)
      ? current.length === 1 ? current : current.filter((id) => id !== storeId)
      : data.stores.map((store) => store.id).filter((id) => [...current, storeId].includes(id)));
    setWinner("all");
  }

  function resetFilters() {
    setQuery("");
    setCategory("All categories");
    setWinner("all");
    setSaleOnly(false);
    setSort("spread");
  }

  const hasFilters = query || category !== "All categories" || winner !== "all" || saleOnly || sort !== "spread";

  return (
    <main id="top">
      <header className="hero">
        <nav className="topbar" aria-label="Page navigation">
          <a className="brand" href="#top">West Seattle Grocery Index</a>
          <div className="nav-links">
            <a href="#compare">Compare stores</a>
            <a href="#research">Markup research</a>
            <a href="#products">Products</a>
            <a className="download-link" href="/west-seattle-grocery-prices.csv" download>CSV</a>
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">West Seattle · direct + marketplace snapshot · {integer.format(data.summary.comparableProducts)} comparable products</p>
            <h1>Five stores.<br /><em>One honest price map.</em></h1>
            <p className="hero-deck">
              PCC, Metropolitan Market, Safeway, QFC, and Whole Foods compared product by product. Every two-store pairing currently has at least <strong>{integer.format(minimumPairCount)} confidently matched items</strong>—and you can choose the matchup.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#compare">Build a comparison <ArrowIcon /></a>
              <span>Captured {data.metadata.capturedAtLabel}</span>
            </div>
          </div>

          <div className="performance-panel" aria-label="Overall head-to-head store performance">
            <div className="panel-heading"><span>All captured matchups</span><span className="live-dot">price snapshot</span></div>
            {data.storePerformance.map((performance, index) => {
              const store = storeMap.get(performance.storeId)!;
              return (
                <div className="performance-row" key={store.id} style={{ "--store-color": store.color } as React.CSSProperties}>
                  <span className="rank">{index + 1}</span>
                  <div><strong>{store.name}</strong><small>{performance.wins} wins · {performance.winRate}% win rate</small></div>
                  <span className="index-value">{performance.priceIndex}</span>
                </div>
              );
            })}
            <p className="panel-note">Price index: 100 is the product-level average; lower is cheaper. {storeMap.get(bestPerformance.storeId)!.shortName} leads this snapshot.</p>
          </div>
        </section>
      </header>

      <div className="score-strip">
        <div><strong>{integer.format(data.summary.comparableProducts)}</strong><span>comparable products</span></div>
        <div><strong>{integer.format(data.summary.allStoreProducts)}</strong><span>at all five stores</span></div>
        <div><strong>{integer.format(data.summary.currentObservationCount)}</strong><span>current price rows</span></div>
        <div><strong>{minimumPairCount}+</strong><span>in every pair</span></div>
      </div>

      <section className="content-section compare-section" id="compare" aria-labelledby="compare-heading">
        <div className="section-intro split-intro">
          <div><p className="eyebrow">Interactive comparison</p><h2 id="compare-heading">Choose your stores.</h2></div>
          <p>With two stores selected, every result is a shared product. With three to five, choose broad pairwise coverage or require the item at every selected store.</p>
        </div>

        <div className="store-selector" aria-label="Stores to compare">
          {data.stores.map((store) => {
            const active = selected.includes(store.id);
            return (
              <button
                className={`store-toggle ${active ? "active" : ""}`}
                type="button"
                onClick={() => toggleStore(store.id)}
                aria-pressed={active}
                key={store.id}
                style={{ "--store-color": store.color } as React.CSSProperties}
              >
                <span className="store-check">{active ? "✓" : "+"}</span>
                <span><strong>{store.name}</strong><small>{active ? "Included" : "Add to comparison"}</small></span>
              </button>
            );
          })}
        </div>

        {selected.length > 2 && (
          <div className="mode-switch" role="group" aria-label="Product availability requirement">
            <button className={!requireAll ? "active" : ""} type="button" onClick={() => setRequireAll(false)}>Available at 2+ selected stores</button>
            <button className={requireAll ? "active" : ""} type="button" onClick={() => setRequireAll(true)}>Available at every selected store</button>
          </div>
        )}

        <div className="comparison-overview">
          <article className="basket-card">
            <div className="card-heading"><span>Fair one-of-each basket</span><span>{strictCommonProducts.length} products at every selected store</span></div>
            <div className="basket-totals">
              {basketRanking.map((storeId, index) => {
                const store = storeMap.get(storeId)!;
                return (
                  <div className={index === 0 ? "basket-leader" : ""} key={storeId} style={{ "--store-color": store.color } as React.CSSProperties}>
                    <span>{store.shortName}</span><strong>{money.format(basketTotals[storeId])}</strong>{index === 0 && <small>lowest basket</small>}
                  </div>
                );
              })}
            </div>
            {selected.length > 1 && <p><strong>{storeMap.get(basketLeader)!.name}</strong> is {money.format(basketSavings)} below the highest total on the strict shared basket.</p>}
          </article>

          <article className="coverage-card">
            <p className="eyebrow">Coverage</p>
            <strong>{integer.format(allSelectedProducts.length)}</strong>
            <span>{requireAll || selected.length <= 2 ? "exact shared products" : "products comparable across at least two selected stores"}</span>
            <div><span>Strict common set</span><b>{integer.format(strictCommonProducts.length)}</b></div>
            <div><span>Selected stores</span><b>{selected.length}</b></div>
          </article>
        </div>

        {selectedPairs.length > 0 && (
          <div className="pair-grid" aria-label="Pairwise basket summaries">
            {selectedPairs.map((pair) => {
              const first = storeMap.get(pair.stores[0])!;
              const second = storeMap.get(pair.stores[1])!;
              const leader = pair.cheaperStore ? storeMap.get(pair.cheaperStore)! : null;
              return (
                <article className="pair-card" key={pair.stores.join("-")}>
                  <div><strong>{first.shortName} vs. {second.shortName}</strong><span>{pair.count} matched products</span></div>
                  <p>{leader ? <><b>{leader.shortName}</b> lower by {money.format(pair.savings)} ({pair.percentDifference}%)</> : "Exact basket tie"}</p>
                  <small>{first.shortName} {money.format(pair.totals[first.id]!)} · {second.shortName} {money.format(pair.totals[second.id]!)}</small>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="research-section" id="research" aria-labelledby="research-heading">
        <div className="content-section">
          <div className="section-intro split-intro">
            <div><p className="eyebrow">Instacart markup research</p><h2 id="research-heading">What we can prove—and what we can’t.</h2></div>
            <p>Official storefronts and terms carry the most weight. Independent reporting adds context. Blogs and Reddit are treated as signal only, and never as proof of a store-specific percentage.</p>
          </div>

          <div className="research-lede">
            <span>Bottom line · researched {data.pricingResearch.updatedAt}</span>
            <h3>{data.pricingResearch.headline}</h3>
            <p>{data.pricingResearch.conclusion}</p>
          </div>

          <div className="verdict-grid">
            {data.pricingResearch.verdicts.map((verdict) => {
              const store = storeMap.get(verdict.storeId)!;
              return (
                <article className="verdict-card" key={verdict.storeId} style={{ "--store-color": store.color } as React.CSSProperties}>
                  <div className="verdict-card-heading">
                    <div><span>{store.name}</span><h3>{verdict.status}</h3></div>
                    <b>{verdict.confidence}</b>
                  </div>
                  <p>{verdict.summary}</p>
                  <ul>{verdict.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                  <div className="research-links">
                    {verdict.sources.map((source) => (
                      <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                        <span>{source.label}</span>
                        {source.tier && <small>{source.tier}</small>}
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="direct-audit" aria-labelledby="direct-audit-heading">
            <div className="direct-audit-heading">
              <div><p className="eyebrow">Where we can measure it</p><h3 id="direct-audit-heading">Instacart versus the native store site.</h3></div>
              <p>These are exact-product basket comparisons from the captured catalogs—not a claim about checkout fees, tips, loyalty coupons, or PCC and Metro.</p>
            </div>
            <div className="direct-audit-grid">
              {data.pricingResearch.directAudit.map((audit) => {
                const store = storeMap.get(audit.storeId)!;
                return (
                  <article key={audit.storeId} style={{ "--store-color": store.color } as React.CSSProperties}>
                    <div><span>{store.name}</span><b>{integer.format(audit.comparedProducts)} exact products</b></div>
                    <p><strong>{audit.basketPercent}% higher</strong> on the captured Instacart basket</p>
                    <dl>
                      <div><dt>Instacart total</dt><dd>{money.format(audit.totalInstacart)}</dd></div>
                      <div><dt>Direct-site total</dt><dd>{money.format(audit.totalDirect)}</dd></div>
                      <div><dt>Difference</dt><dd>{money.format(audit.basketDifference)}</dd></div>
                      <div><dt>Median item gap</dt><dd>{money.format(audit.medianDifference)}</dd></div>
                    </dl>
                    <small>Instacart higher on {integer.format(audit.instacartHigherCount)} · same on {integer.format(audit.samePriceCount)} · direct higher on {integer.format(audit.directHigherCount)}</small>
                  </article>
                );
              })}
            </div>
            <p className="direct-audit-note">Captured on adjacent July 2026 dates and matched conservatively by brand, variant, and package quantity. Sale timing can affect an individual item, but the breadth and direction of the differences are strong evidence of marketplace upcharges for these two catalogs.</p>
          </div>

          <div className="corpus-ledger" aria-labelledby="ledger-heading">
            <div className="ledger-heading">
              <div><p className="eyebrow">Current data ledger</p><h3 id="ledger-heading">Everything in the working corpus.</h3></div>
              <p>The SQLite database retains every dated observation, including older Safeway and QFC Instacart rows. The live comparison substitutes their direct-site prices.</p>
            </div>
            <div className="ledger-grid">
              <div><strong>{integer.format(data.summary.observationCount)}</strong><span>dated observations in SQLite</span></div>
              <div><strong>{integer.format(data.summary.comparableProducts)}</strong><span>products comparable in 2+ stores</span></div>
              <div><strong>{integer.format(data.summary.acceptedCrossSourceMatches)}</strong><span>accepted Whole Foods links</span></div>
              <div><strong>{integer.format(data.summary.directReplacements.safeway)}</strong><span>accepted Safeway direct links</span></div>
              <div><strong>{integer.format(data.summary.directReplacements.qfc)}</strong><span>accepted QFC direct links</span></div>
              <div><strong>{integer.format(data.summary.queryCount)}</strong><span>captured search queries</span></div>
            </div>
            <div className="coverage-funnel" aria-label="Progress toward products present at all five stores">
              <div><span>Original four-store Instacart overlap</span><strong>{integer.format(data.summary.instacartAllFourProducts)}</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>Also matched on both direct sites</span><strong>{integer.format(data.summary.bothDirectAllFourProducts)}</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>Also matched at Whole Foods</span><strong>{integer.format(data.summary.wholeFoodsAllFourProducts)}</strong></div>
              <i aria-hidden="true">→</i>
              <div className="funnel-result"><span>Confirmed across all five</span><strong>{integer.format(data.summary.allStoreProducts)}</strong></div>
            </div>
            <p className="funnel-note">The two middle sets overlap but are not nested: the final all-five count is their intersection. Direct source catalogs currently contain {integer.format(data.summary.directCatalogProducts.safeway)} Safeway, {integer.format(data.summary.directCatalogProducts.qfc)} QFC, and {integer.format(data.summary.directCatalogProducts.wholefoods)} Whole Foods observations.</p>
          </div>

          <div className="research-context-grid">
            {data.pricingResearch.context.map((entry) => (
              <article key={entry.title}>
                <h3>{entry.title}</h3>
                <p>{entry.body}</p>
                <div>
                  {entry.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} ↗</a>)}
                </div>
              </article>
            ))}
          </div>

          <div className="research-limits">
            <strong>Limits of this conclusion</strong>
            <ul>{data.pricingResearch.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="content-section category-section" id="categories" aria-labelledby="category-heading">
        <div className="section-intro split-intro">
          <div><p className="eyebrow">Strict category baskets</p><h2 id="category-heading">A broad aisle-by-aisle view.</h2></div>
          <p>These cards use only products stocked by every selected store, so each category total is directly comparable. The responsive card layout stays usable on narrow screens.</p>
        </div>
        <div className="category-grid">
          {dynamicCategories.map((entry) => (
            <article className="category-card" key={entry.name}>
              <div><h3>{entry.name}</h3><span>{entry.count} products</span></div>
              <div className="category-prices">
                {selected.map((storeId) => (
                  <p className={entry.leader === storeId ? "category-leader" : ""} key={storeId}>
                    <span>{storeMap.get(storeId)!.shortName}</span><strong>{money.format(entry.totals[storeId])}</strong>
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="products-section" id="products" aria-labelledby="products-heading">
        <div className="content-section products-inner">
          <div className="section-intro split-intro">
            <div><p className="eyebrow">The full corpus</p><h2 id="products-heading">Every item. Every captured price.</h2></div>
            <p>PCC and Metro use Instacart catalogs; Safeway and QFC use their direct pickup sites; Whole Foods uses Amazon. Cross-source links require the same brand, variant, and package quantity. A blank price means no confident current match was captured.</p>
          </div>

          <div className="filter-panel">
            <label className="search-control"><span className="sr-only">Search products</span><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={`Search ${integer.format(allSelectedProducts.length)} products…`} /></label>
            <label className="select-control"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{data.categories.map((entry) => <option key={entry.category}>{entry.category}</option>)}</select></label>
            <label className="select-control"><span>Lowest price</span><select value={winner} onChange={(event) => setWinner(event.target.value as WinnerFilter)}><option value="all">Any store</option>{selected.map((storeId) => <option value={storeId} key={storeId}>{storeMap.get(storeId)!.shortName}</option>)}<option value="tie">Ties</option></select></label>
            <label className="select-control"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="spread">Biggest price spread</option><option value="name">Product name</option><option value="category">Category</option><option value="lowest-price">Lowest price</option></select></label>
            <label className="checkbox-control"><input type="checkbox" checked={saleOnly} onChange={(event) => setSaleOnly(event.target.checked)} /><span>Sales only</span></label>
          </div>

          <div className="results-heading">
            <p><strong>{integer.format(filtered.length)}</strong> {filtered.length === 1 ? "product" : "products"} · showing {integer.format(Math.min(visibleCount, filtered.length))}</p>
            {hasFilters && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>

          <div className="product-list">
            {filtered.slice(0, visibleCount).map((product) => <ProductCard product={product} stores={data.stores} selected={selected} key={product.id} />)}
            {filtered.length === 0 && <div className="empty-state"><h3>No products match</h3><p>Try clearing a filter or using a broader product name.</p><button type="button" onClick={resetFilters}>Show all products</button></div>}
          </div>
          {visibleCount < filtered.length && <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 72)}>Show 72 more products</button>}
        </div>
      </section>

      <footer className="site-footer">
        <div><p className="eyebrow">Methodology</p><h2>Exact products, dated observations, honest caveats.</h2></div>
        <div className="footer-copy">
          <p>{data.metadata.methodology}</p>
          <p>{data.metadata.caveat}</p>
          <p>{data.metadata.locationNote}</p>
          <div className="source-section" aria-labelledby="source-heading">
            <div className="source-heading">
              <h3 id="source-heading">Where each price comes from</h3>
              <p>Every price tile names its corpus. Historical Instacart observations for Safeway and QFC remain in SQLite, but never appear as their current prices.</p>
            </div>
            <div className="source-grid">
              {data.stores.map((store) => (
                <article className="source-card" key={store.id} style={{ "--store-color": store.color } as React.CSSProperties}>
                  <div className="source-card-top">
                    <span>{store.shortName}</span>
                    <b>{store.catalogSource}</b>
                  </div>
                  <p className="source-type">{store.sourceType}</p>
                  <p>{store.platformNote}</p>
                  <div className="source-policy">
                    <strong>{store.pricingPolicyTitle}</strong>
                    <span>{store.pricingPolicySummary}</span>
                  </div>
                  <div className="source-links">
                    <a href={store.catalogUrl} target="_blank" rel="noreferrer">Price corpus ↗</a>
                    <a href={store.pricingPolicyUrl} target="_blank" rel="noreferrer">Pricing policy ↗</a>
                    {store.termsUrl && <a href={store.termsUrl} target="_blank" rel="noreferrer">Platform terms ↗</a>}
                    {store.markupContextUrl && <a href={store.markupContextUrl} target="_blank" rel="noreferrer">Markup context ↗</a>}
                    {store.researchUrl && <a href={store.researchUrl} target="_blank" rel="noreferrer">Independent context ↗</a>}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="store-locations">
            {data.stores.map((store) => <a key={store.id} href={store.storeUrl} target="_blank" rel="noreferrer"><span>{store.name}</span><span>{store.address}</span></a>)}
          </div>
          <div className="footer-links"><a href="/west-seattle-grocery-prices.csv" download>Download {integer.format(data.summary.comparableProducts)} comparable products as CSV <ArrowIcon /></a><a href="https://github.com/jubishop/grocery" target="_blank" rel="noreferrer">SQLite database + source on GitHub <ArrowIcon /></a></div>
        </div>
      </footer>
    </main>
  );
}
