"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  compareBasketByStore,
  MAX_BASKET_QUANTITY,
  sanitizeBasket,
  type BasketQuantities,
} from "./basket";
import {
  DIET_OPTIONS,
  getDietOption,
  productHasDietClaim,
  type DietFilter,
} from "./diet";

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
const basketStorageKey = "west-seattle-grocery-basket-v1";

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

function ProductCard({
  product,
  stores,
  selected,
  diet,
  basketQuantity,
  onAddToBasket,
}: {
  product: Product;
  stores: Store[];
  selected: StoreId[];
  diet: DietFilter;
  basketQuantity: number;
  onAddToBasket: (productId: string) => void;
}) {
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
            {diet !== "all" && <span className="diet-claim-badge">{getDietOption(diet).badge}</span>}
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
              <small>{price.priceBasis}</small>
              <small className="price-source">{price.sale ? "sale shown · " : ""}{priceSourceLabels[price.source]?.label ?? price.source}</small>
              <small>{priceSourceLabels[price.source]?.action ?? "View source"} ↗</small>
            </a>
          );
        })}
      </div>

      <div className="product-result">
        <div className="product-result-copy">
          <span>{winnerLabel}</span>
          <strong>{spread > 0 ? `${money.format(spread)} spread` : "Exact tie"}</strong>
        </div>
        <button
          className={`basket-add-button ${basketQuantity > 0 ? "active" : ""}`}
          type="button"
          onClick={() => onAddToBasket(product.id)}
          disabled={basketQuantity >= MAX_BASKET_QUANTITY}
          aria-label={basketQuantity > 0
            ? `Add another ${product.name} to basket. Current quantity ${basketQuantity}`
            : `Add ${product.name} to basket`}
        >
          <span aria-hidden="true">{basketQuantity > 0 ? basketQuantity : "+"}</span>
          {basketQuantity > 0 ? "Add another" : "Add to basket"}
        </button>
      </div>
    </article>
  );
}

export default function GroceryExplorer({ data }: { data: Dataset }) {
  const [selected, setSelected] = useState<StoreId[]>(data.stores.map((store) => store.id));
  const [requireAll, setRequireAll] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [winner, setWinner] = useState<WinnerFilter>("all");
  const [saleOnly, setSaleOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("spread");
  const [visibleCount, setVisibleCount] = useState(48);
  const [basket, setBasket] = useState<BasketQuantities>({});
  const [basketLoaded, setBasketLoaded] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const storeMap = useMemo(() => new Map(data.stores.map((store) => [store.id, store])), [data.stores]);
  const productMap = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const validProductIds = useMemo(() => new Set(data.products.map((product) => product.id)), [data.products]);

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = targetId ? document.getElementById(targetId) : document.getElementById("top");
    window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: "auto", block: "start" }));
  }, []);

  useEffect(() => setVisibleCount(48), [selected, requireAll, deferredQuery, category, diet, winner, saleOnly, sort]);

  useEffect(() => {
    try {
      const storedBasket = window.localStorage.getItem(basketStorageKey);
      if (storedBasket) setBasket(sanitizeBasket(JSON.parse(storedBasket), validProductIds));
    } catch {
      // Ignore malformed or unavailable device storage and start with an empty basket.
    } finally {
      setBasketLoaded(true);
    }
  }, [validProductIds]);

  useEffect(() => {
    if (!basketLoaded) return;
    try {
      window.localStorage.setItem(basketStorageKey, JSON.stringify(basket));
    } catch {
      // The basket still works for this visit when browser storage is unavailable.
    }
  }, [basket, basketLoaded]);

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
      const matchesDiet = productHasDietClaim(product, diet);
      const selectedPrices = productPrices(product, selected);
      const matchesSale = !saleOnly || selectedPrices.some((entry) => entry.sale);
      const lowest = lowestStores(product, selected);
      const matchesWinner = winner === "all" || (winner === "tie" ? lowest.length > 1 : lowest.length === 1 && lowest[0] === winner);
      return matchesSearch && matchesCategory && matchesDiet && matchesSale && matchesWinner;
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
  }, [allSelectedProducts, category, deferredQuery, diet, saleOnly, selected, sort, winner]);

  const dietCounts = useMemo(() => Object.fromEntries(
    DIET_OPTIONS.map((option) => [
      option.value,
      allSelectedProducts.filter((product) => productHasDietClaim(product, option.value)).length,
    ]),
  ) as Record<Exclude<DietFilter, "all">, number>, [allSelectedProducts]);

  const snapshotBasketTotals = useMemo(() => Object.fromEntries(selected.map((storeId) => [
    storeId,
    strictCommonProducts.reduce((total, product) => total + product.prices[storeId]!.price, 0),
  ])) as Record<StoreId, number>, [selected, strictCommonProducts]);

  const snapshotBasketRanking = [...selected].sort((a, b) => snapshotBasketTotals[a] - snapshotBasketTotals[b]);
  const snapshotBasketLeader = snapshotBasketRanking[0];
  const snapshotBasketSavings = snapshotBasketRanking.length > 1
    ? snapshotBasketTotals[snapshotBasketRanking.at(-1)!] - snapshotBasketTotals[snapshotBasketLeader]
    : 0;
  const selectedPairs = data.pairwise.filter((pair) => pair.stores.every((storeId) => selected.includes(storeId)));
  const minimumPairCount = Math.min(...data.pairwise.map((pair) => pair.count));
  const bestPerformance = data.storePerformance[0];

  const basketItems = useMemo(() => Object.entries(basket).flatMap(([productId, quantity]) => {
    const product = productMap.get(productId);
    return product ? [{ product, quantity }] : [];
  }), [basket, productMap]);
  const basketUnitCount = basketItems.reduce((total, item) => total + item.quantity, 0);
  const basketComparisons = useMemo(() => compareBasketByStore(
    basketItems.map(({ product, quantity }) => ({
      id: product.id,
      name: product.name,
      quantity,
      prices: product.prices,
    })),
    selected,
  ), [basketItems, selected]);
  const completeBasketComparisons = basketComparisons.filter((comparison) => comparison.complete);
  const cheapestBasketTotal = completeBasketComparisons[0]?.total;
  const cheapestBasketComparisons = cheapestBasketTotal === undefined
    ? []
    : completeBasketComparisons.filter((comparison) => comparison.total === cheapestBasketTotal);
  const nextCheapestBasket = cheapestBasketTotal === undefined
    ? undefined
    : completeBasketComparisons.find((comparison) => comparison.total > cheapestBasketTotal);

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

  function changeBasketQuantity(productId: string, amount: number) {
    setBasket((current) => {
      const nextQuantity = Math.min(MAX_BASKET_QUANTITY, (current[productId] ?? 0) + amount);
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: nextQuantity };
    });
  }

  function resetFilters() {
    setQuery("");
    setCategory("All categories");
    setDiet("all");
    setWinner("all");
    setSaleOnly(false);
    setSort("spread");
  }

  const hasFilters = query || category !== "All categories" || diet !== "all" || winner !== "all" || saleOnly || sort !== "spread";
  let basketVerdict: React.ReactNode = null;

  if (basketItems.length > 0) {
    if (completeBasketComparisons.length === 0) {
      basketVerdict = <>No selected store has every item. Captured subtotals are shown, but they are not treated as a fair basket total.</>;
    } else if (selected.length === 1) {
      const comparison = completeBasketComparisons[0];
      basketVerdict = <>Your basket totals <strong>{money.format(comparison.total)}</strong> at {storeMap.get(comparison.storeId)!.name}.</>;
    } else if (completeBasketComparisons.length === 1) {
      const comparison = completeBasketComparisons[0];
      basketVerdict = <><strong>{storeMap.get(comparison.storeId)!.name}</strong> is the only selected store with every item, totaling <strong>{money.format(comparison.total)}</strong>.</>;
    } else if (cheapestBasketComparisons.length > 1) {
      const storeNames = cheapestBasketComparisons.map((comparison) => storeMap.get(comparison.storeId)!.shortName).join(" + ");
      basketVerdict = <><strong>{storeNames}</strong> tie for the lowest complete basket at <strong>{money.format(cheapestBasketTotal!)}</strong>.</>;
    } else {
      const cheapest = cheapestBasketComparisons[0];
      const nextStore = nextCheapestBasket ? storeMap.get(nextCheapestBasket.storeId)! : null;
      basketVerdict = (
        <>
          <strong>{storeMap.get(cheapest.storeId)!.name}</strong> is cheapest at <strong>{money.format(cheapest.total)}</strong>
          {nextCheapestBasket && nextStore
            ? <>, saving <strong>{money.format(nextCheapestBasket.total - cheapest.total)}</strong> versus {nextStore.shortName}.</>
            : "."}
        </>
      );
    }
  }

  return (
    <main id="top">
      <header className="hero">
        <nav className="topbar" aria-label="Page navigation">
          <a className="brand" href="#top">West Seattle Grocery Index</a>
          <div className="nav-links">
            <a href="#compare">Compare stores</a>
            <a href="#products">Products</a>
            <a className="basket-nav" href="#basket">
              My basket
              {basketUnitCount > 0 && <span>{basketUnitCount}</span>}
            </a>
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
              <a className="primary-button" href="#basket">Build your basket <ArrowIcon /></a>
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

        <section className="custom-basket" id="basket" aria-labelledby="basket-heading">
          <div className="custom-basket-intro">
            <div>
              <p className="eyebrow">Your shopping list</p>
              <h2 id="basket-heading">Build the basket you’ll actually buy.</h2>
            </div>
            <p>Add exact products from the catalog below, choose quantities, and compare a complete checkout at every selected store. Your basket stays on this device.</p>
          </div>

          {basketItems.length === 0 ? (
            <div className="custom-basket-empty">
              <span aria-hidden="true">+</span>
              <div>
                <h3>Your basket is empty</h3>
                <p>Browse the matched products, then use “Add to basket” on anything you intend to buy.</p>
              </div>
              <a href="#products">Browse products <ArrowIcon /></a>
            </div>
          ) : (
            <div className="custom-basket-workspace">
              <article className="basket-list-card">
                <div className="basket-list-heading">
                  <div>
                    <span>My list</span>
                    <strong>{basketItems.length} {basketItems.length === 1 ? "product" : "products"} · {basketUnitCount} {basketUnitCount === 1 ? "item" : "items"}</strong>
                  </div>
                  <button type="button" onClick={() => setBasket({})}>Clear basket</button>
                </div>

                <ul className="basket-item-list">
                  {basketItems.map(({ product, quantity }) => {
                    const availableStoreCount = selected.filter((storeId) => product.prices[storeId]).length;
                    return (
                      <li key={product.id}>
                        <div className="basket-item-image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imagePath || product.imageUrl}
                            alt=""
                            loading="lazy"
                            width="58"
                            height="58"
                            onError={(event) => {
                              if (event.currentTarget.src !== product.imageUrl) event.currentTarget.src = product.imageUrl;
                              else event.currentTarget.style.visibility = "hidden";
                            }}
                          />
                        </div>
                        <div className="basket-item-copy">
                          <strong>{product.name}</strong>
                          <span>{product.size || product.priceBasis}</span>
                          <small>
                            {availableStoreCount === selected.length
                              ? `At all ${selected.length} selected ${selected.length === 1 ? "store" : "stores"}`
                              : `At ${availableStoreCount} of ${selected.length} selected stores`}
                          </small>
                        </div>
                        <div className="quantity-stepper" role="group" aria-label={`Quantity for ${product.name}`}>
                          <button type="button" onClick={() => changeBasketQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`}>−</button>
                          <output aria-label={`${quantity} in basket`}>{quantity}</output>
                          <button
                            type="button"
                            onClick={() => changeBasketQuantity(product.id, 1)}
                            disabled={quantity >= MAX_BASKET_QUANTITY}
                            aria-label={`Add one ${product.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button className="basket-remove" type="button" onClick={() => changeBasketQuantity(product.id, -quantity)} aria-label={`Remove ${product.name} from basket`}>Remove</button>
                      </li>
                    );
                  })}
                </ul>
              </article>

              <article className="basket-results-card">
                <div className="basket-results-heading">
                  <div>
                    <span>Selected-store totals</span>
                    <h3>{completeBasketComparisons.length > 0 ? "Cheapest complete basket" : "No complete basket yet"}</h3>
                  </div>
                  <span>{selected.length} {selected.length === 1 ? "store" : "stores"} compared</span>
                </div>

                <div className="custom-basket-totals">
                  {basketComparisons.map((comparison) => {
                    const store = storeMap.get(comparison.storeId)!;
                    const isCheapest = comparison.complete && cheapestBasketComparisons.some((entry) => entry.storeId === comparison.storeId);
                    const missingNames = comparison.missingItems.slice(0, 2).map((item) => item.name).join(", ");
                    const remainingMissing = comparison.missingItems.length - 2;
                    return (
                      <div
                        className={`${comparison.complete ? "complete" : "incomplete"} ${isCheapest ? "cheapest" : ""}`}
                        key={comparison.storeId}
                        style={{ "--store-color": store.color } as React.CSSProperties}
                      >
                        <div>
                          <span>{store.shortName}</span>
                          {isCheapest && <b>{cheapestBasketComparisons.length > 1 ? "Lowest tie" : "Cheapest"}</b>}
                        </div>
                        <strong>{money.format(comparison.total)}</strong>
                        <p>{comparison.complete ? "Complete total" : `Captured subtotal · ${comparison.missingItems.length} unavailable`}</p>
                        {!comparison.complete && (
                          <small>{missingNames}{remainingMissing > 0 ? ` + ${remainingMissing} more` : ""}</small>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="basket-verdict" aria-live="polite">{basketVerdict}</p>
                <p className="basket-total-note">Only stores with every basket product are eligible to be called cheapest. Displayed sale and member prices are included; checkout fees, tips, and clip-once coupons are not.</p>
              </article>
            </div>
          )}
        </section>

        <div className="comparison-overview">
          <article className="basket-card">
            <div className="card-heading"><span>Snapshot-wide one-of-each basket</span><span>{strictCommonProducts.length} products at every selected store</span></div>
            <div className="basket-totals">
              {snapshotBasketRanking.map((storeId, index) => {
                const store = storeMap.get(storeId)!;
                return (
                  <div className={index === 0 ? "basket-leader" : ""} key={storeId} style={{ "--store-color": store.color } as React.CSSProperties}>
                    <span>{store.shortName}</span><strong>{money.format(snapshotBasketTotals[storeId])}</strong>{index === 0 && <small>lowest basket</small>}
                  </div>
                );
              })}
            </div>
            {selected.length > 1 && <p><strong>{storeMap.get(snapshotBasketLeader)!.name}</strong> is {money.format(snapshotBasketSavings)} below the highest total on the strict shared basket.</p>}
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

      <aside className="content-section research-footnote" id="research" aria-labelledby="research-heading">
        <details>
          <summary>
            <span><strong>Source note</strong> PCC and Metropolitan Market prices come from Instacart; supporting pricing research is available here.</span>
            <span className="research-footnote-action">Research &amp; evidence</span>
          </summary>
          <div className="research-footnote-body">
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
              <p>These are exact-product basket comparisons from the captured catalogs—not a claim about checkout fees, tips, clip-once coupons, or PCC and Metro. Displayed member and club prices are included.</p>
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
              <p>The SQLite database stores only the price corpora used by the comparison. Safeway and QFC Instacart prices are omitted; their product identifiers and query evidence remain for crosswalk auditing, while the measured markup comparison survives as aggregate statistics.</p>
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
        </details>
      </aside>

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
            <div><p className="eyebrow">Build your basket</p><h2 id="products-heading">Find it. Price it. Add it.</h2></div>
            <p>Add the exact products you plan to buy, then use the basket shortcut to compare complete totals. Cross-source links require the same brand, variant, and package quantity; a blank price means no confident current match was captured.</p>
          </div>

          <div className="filter-panel">
            <label className="search-control"><span className="sr-only">Search products</span><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={`Search ${integer.format(allSelectedProducts.length)} products…`} /></label>
            <label className="select-control"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{data.categories.map((entry) => <option key={entry.category}>{entry.category}</option>)}</select></label>
            <label className="select-control"><span>Diet</span><select value={diet} onChange={(event) => setDiet(event.target.value as DietFilter)}><option value="all">All products</option>{DIET_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label} ({dietCounts[option.value]})</option>)}</select></label>
            <label className="select-control"><span>Lowest price</span><select value={winner} onChange={(event) => setWinner(event.target.value as WinnerFilter)}><option value="all">Any store</option>{selected.map((storeId) => <option value={storeId} key={storeId}>{storeMap.get(storeId)!.shortName}</option>)}<option value="tie">Ties</option></select></label>
            <label className="select-control"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="spread">Biggest price spread</option><option value="name">Product name</option><option value="category">Category</option><option value="lowest-price">Lowest price</option></select></label>
            <label className="checkbox-control"><input type="checkbox" checked={saleOnly} onChange={(event) => setSaleOnly(event.target.checked)} /><span>Sales only</span></label>
          </div>

          {diet !== "all" && (
            <div className={`diet-filter-note ${diet === "gluten-free" ? "celiac-note" : ""}`} role="note" aria-live="polite">
              <div>
                <strong>{getDietOption(diet).label}s only</strong>
                <span>
                  {diet === "gluten-free"
                    ? "This conservative filter includes products whose catalog title explicitly says gluten-free; naturally gluten-free foods without that claim are left out."
                    : "This filter uses explicit wording in the captured catalog title and does not infer a diet from ingredients or product category."}
                </span>
              </div>
              <p>
                {diet === "gluten-free"
                  ? <>For celiac safety, verify the current package label, ingredients, and cross-contact information before buying. <a href="https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/questions-and-answers-gluten-free-food-labeling-final-rule" target="_blank" rel="noreferrer">FDA labeling guidance ↗</a></>
                  : "Ingredients and cross-contact information are not independently verified; check the current package before buying."}
              </p>
            </div>
          )}

          <div className="results-heading">
            <p><strong>{integer.format(filtered.length)}</strong> {filtered.length === 1 ? "product" : "products"} · showing {integer.format(Math.min(visibleCount, filtered.length))}</p>
            {hasFilters && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>

          <div className="product-list">
            {filtered.slice(0, visibleCount).map((product) => (
              <ProductCard
                product={product}
                stores={data.stores}
                selected={selected}
                diet={diet}
                basketQuantity={basket[product.id] ?? 0}
                onAddToBasket={(productId) => changeBasketQuantity(productId, 1)}
                key={product.id}
              />
            ))}
            {filtered.length === 0 && <div className="empty-state"><h3>No products match</h3><p>Try clearing a filter or using a broader product name.</p><button type="button" onClick={resetFilters}>Show all products</button></div>}
          </div>
          {visibleCount < filtered.length && <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 72)}>Show 72 more products</button>}
        </div>
      </section>

      {basketUnitCount > 0 && (
        <a className="basket-jump" href="#basket" aria-label={`View basket with ${basketUnitCount} ${basketUnitCount === 1 ? "item" : "items"} and compare totals`}>
          <span aria-hidden="true">{basketUnitCount}</span>
          <div>
            <small>My basket</small>
            <strong>See cheapest total</strong>
          </div>
        </a>
      )}

      <footer className="site-footer">
        <div><p className="eyebrow">Methodology</p><h2>Exact products, dated observations, honest caveats.</h2></div>
        <div className="footer-copy">
          <p>{data.metadata.methodology}</p>
          <p>{data.metadata.caveat}</p>
          <p>{data.metadata.locationNote}</p>
          <div className="source-section" aria-labelledby="source-heading">
            <div className="source-heading">
              <h3 id="source-heading">Where each price comes from</h3>
              <p>Every price tile names its corpus. Safeway and QFC Instacart prices are excluded from SQLite; only non-price matching evidence and aggregate markup diagnostics remain.</p>
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
