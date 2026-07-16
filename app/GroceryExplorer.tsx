"use client";

import { useDeferredValue, useMemo, useState } from "react";

type Winner = "PCC" | "Metropolitan Market" | "Tie";

type Item = {
  id: string;
  name: string;
  size: string;
  category: string;
  source: string;
  priceBasis: string;
  pccPrice: number;
  metroPrice: number;
  pccOriginal: number | null;
  metroOriginal: number | null;
  pccSale: boolean;
  metroSale: boolean;
  winner: Winner;
  difference: number;
  percentDifference: number;
  pccUrl: string;
  metroUrl: string;
  imageUrl: string;
  imagePath: string;
};

type CategorySummary = {
  category: string;
  count: number;
  pccTotal: number;
  metroTotal: number;
  difference: number;
  percentDifference: number;
  pccWins: number;
  metroWins: number;
  ties: number;
  winner: Winner;
};

export type Dataset = {
  metadata: {
    capturedAtLabel: string;
    deliveryAddress: string;
    methodology: string;
    caveat: string;
  };
  summary: {
    itemCount: number;
    pccTotal: number;
    metroTotal: number;
    difference: number;
    percentDifference: number;
    pccWins: number;
    metroWins: number;
    ties: number;
    medianPercentDifference: number;
    pccSaleItems: number;
    metroSaleItems: number;
    noSale: {
      itemCount: number;
      pccTotal: number;
      metroTotal: number;
      difference: number;
      pccWins: number;
      metroWins: number;
      ties: number;
    };
  };
  categories: CategorySummary[];
  items: Item[];
};

type SortKey = "pcc-advantage" | "metro-advantage" | "name" | "category" | "pcc-price" | "metro-price";
type WinnerFilter = "all" | "pcc" | "metro" | "tie";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15">
      <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDelta(value: number) {
  if (value === 0) return "Same price";
  return `${money.format(Math.abs(value))} ${value > 0 ? "less at PCC" : "less at Metro"}`;
}

function StorePrice({
  store,
  price,
  original,
  href,
}: {
  store: "PCC" | "Metro";
  price: number;
  original: number | null;
  href: string;
}) {
  return (
    <a className={`store-price ${store === "PCC" ? "store-price-pcc" : "store-price-metro"}`} href={href} target="_blank" rel="noreferrer">
      <span className="store-label">{store}</span>
      <span className="price-row">
        <strong>{money.format(price)}</strong>
        {original !== null && <s>{money.format(original)}</s>}
      </span>
      {original !== null && <span className="sale-label">sale</span>}
      <span className="visit-label">View <ArrowIcon /></span>
    </a>
  );
}

function ProductCard({ item }: { item: Item }) {
  const winnerClass = item.winner === "PCC" ? "winner-pcc" : item.winner === "Metropolitan Market" ? "winner-metro" : "winner-tie";
  return (
    <article className="product-card">
      <div className="product-main">
        <div className="product-image-wrap">
          {/* Product images are downloaded locally from the captured Instacart cards. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="product-image" src={item.imagePath} alt="" loading="lazy" width="104" height="104" />
        </div>
        <div className="product-copy">
          <div className="product-kicker">
            <span>{item.category}</span>
            {item.pccSale || item.metroSale ? <span className="promo-dot">current promotion</span> : null}
          </div>
          <h3>{item.name}</h3>
          <p>{item.size || item.priceBasis}{item.priceBasis === "per lb" && item.size !== "per lb" ? " · per lb comparison" : ""}</p>
        </div>
      </div>

      <div className="product-prices">
        <StorePrice store="PCC" price={item.pccPrice} original={item.pccOriginal} href={item.pccUrl} />
        <StorePrice store="Metro" price={item.metroPrice} original={item.metroOriginal} href={item.metroUrl} />
      </div>

      <div className={`winner-badge ${winnerClass}`}>
        <span>{item.winner === "Tie" ? "Tie" : item.winner === "PCC" ? "PCC wins" : "Metro wins"}</span>
        <strong>{formatDelta(item.difference)}</strong>
      </div>
    </article>
  );
}

export default function GroceryExplorer({ data }: { data: Dataset }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [winner, setWinner] = useState<WinnerFilter>("all");
  const [promotionsOnly, setPromotionsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("pcc-advantage");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const categories = useMemo(() => ["All categories", ...data.categories.map((entry) => entry.category)], [data.categories]);

  const filtered = useMemo(() => {
    const result = data.items.filter((item) => {
      const matchesQuery = !deferredQuery || `${item.name} ${item.size} ${item.category}`.toLowerCase().includes(deferredQuery);
      const matchesCategory = category === "All categories" || item.category === category;
      const matchesWinner =
        winner === "all" ||
        (winner === "pcc" && item.winner === "PCC") ||
        (winner === "metro" && item.winner === "Metropolitan Market") ||
        (winner === "tie" && item.winner === "Tie");
      const matchesPromotion = !promotionsOnly || item.pccSale || item.metroSale;
      return matchesQuery && matchesCategory && matchesWinner && matchesPromotion;
    });

    return result.sort((a, b) => {
      if (sort === "pcc-advantage") return b.difference - a.difference || a.name.localeCompare(b.name);
      if (sort === "metro-advantage") return a.difference - b.difference || a.name.localeCompare(b.name);
      if (sort === "pcc-price") return a.pccPrice - b.pccPrice || a.name.localeCompare(b.name);
      if (sort === "metro-price") return a.metroPrice - b.metroPrice || a.name.localeCompare(b.name);
      if (sort === "category") return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [data.items, deferredQuery, category, winner, promotionsOnly, sort]);

  const strongestCategory = [...data.categories].sort((a, b) => b.percentDifference - a.percentDifference)[0];
  const metroCategory = data.categories.find((entry) => entry.winner === "Metropolitan Market");

  function resetFilters() {
    setQuery("");
    setCategory("All categories");
    setWinner("all");
    setPromotionsOnly(false);
    setSort("pcc-advantage");
  }

  return (
    <main>
      <header className="hero">
        <nav className="topbar" aria-label="Page navigation">
          <a className="brand" href="#top" aria-label="Price check home">
            <span className="brand-mark">P<span>:</span>M</span>
            <span>Seattle price check</span>
          </a>
          <div className="nav-links">
            <a href="#categories">Categories</a>
            <a href="#products">All items</a>
            <a className="download-link" href="/pcc-vs-metro-prices.csv" download>Download CSV</a>
          </div>
        </nav>

        <section className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow">Seattle · Instacart snapshot · 298 exact matches</p>
            <h1>For this basket,<br /><em>PCC comes out ahead.</em></h1>
            <p className="hero-deck">
              Buying one of every matched item costs <strong>{money.format(data.summary.difference)} less</strong> at PCC—an overall savings of {data.summary.percentDifference}% against Metropolitan Market.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#products">Explore every item <ArrowIcon /></a>
              <span>Captured {data.metadata.capturedAtLabel}</span>
            </div>
          </div>

          <div className="basket-comparison" aria-label="Basket total comparison">
            <div className="comparison-heading">
              <span>One-of-each basket</span>
              <span className="live-dot">price snapshot</span>
            </div>
            <div className="store-total total-pcc">
              <div><span>PCC Community Markets</span><small>{data.summary.pccWins} item wins</small></div>
              <strong>{money.format(data.summary.pccTotal)}</strong>
            </div>
            <div className="store-total total-metro">
              <div><span>Metropolitan Market</span><small>{data.summary.metroWins} item wins</small></div>
              <strong>{money.format(data.summary.metroTotal)}</strong>
            </div>
            <div className="basket-saving">
              <span>You keep</span>
              <strong>{money.format(data.summary.difference)}</strong>
              <small>with PCC across {data.summary.itemCount} identical products</small>
            </div>
          </div>
        </section>

        <div className="score-strip">
          <div><strong>{data.summary.pccWins}</strong><span>PCC wins</span></div>
          <div><strong>{data.summary.metroWins}</strong><span>Metro wins</span></div>
          <div><strong>{data.summary.ties}</strong><span>Exact ties</span></div>
          <div><strong>{data.summary.medianPercentDifference}%</strong><span>Median PCC advantage</span></div>
        </div>
      </header>

      <section className="content-section takeaway-section" aria-labelledby="takeaway-heading">
        <div className="section-intro">
          <p className="eyebrow">What the data says</p>
          <h2 id="takeaway-heading">The lead holds beyond promotions.</h2>
          <p>Removing every item with a displayed sale at either store leaves {data.summary.noSale.itemCount} products. PCC still saves {money.format(data.summary.noSale.difference)} and wins {data.summary.noSale.pccWins} of them.</p>
        </div>
        <div className="insight-grid">
          <article className="insight-card accent-card">
            <span>Best PCC category</span>
            <strong>{strongestCategory.category}</strong>
            <p>{strongestCategory.percentDifference}% lower across {strongestCategory.count} exact products.</p>
          </article>
          <article className="insight-card">
            <span>Metro&apos;s bright spot</span>
            <strong>{metroCategory?.category ?? "No category"}</strong>
            <p>{metroCategory ? `${Math.abs(metroCategory.percentDifference)}% lower as a category basket.` : "PCC won every category basket."}</p>
          </article>
          <article className="insight-card">
            <span>Displayed sale prices</span>
            <strong>{data.summary.pccSaleItems} vs. {data.summary.metroSaleItems}</strong>
            <p>PCC sale items versus Metro sale items in the matched set.</p>
          </article>
        </div>
      </section>

      <section className="content-section category-section" id="categories" aria-labelledby="category-heading">
        <div className="section-intro split-intro">
          <div>
            <p className="eyebrow">Category scoreboard</p>
            <h2 id="category-heading">Broad coverage, one clear pattern.</h2>
          </div>
          <p>PCC&apos;s one-of-each total is lower in 11 of 12 category baskets. Beverages are the exception, led by lower Metro prices on several coffee and sparkling-water products.</p>
        </div>
        <div className="category-table" role="table" aria-label="Category price comparison">
          <div className="category-row category-header" role="row">
            <span role="columnheader">Category</span>
            <span role="columnheader">Items</span>
            <span role="columnheader">PCC</span>
            <span role="columnheader">Metro</span>
            <span role="columnheader">Result</span>
          </div>
          {data.categories.map((entry) => (
            <div className="category-row" role="row" key={entry.category}>
              <span className="category-name" role="cell">{entry.category}</span>
              <span role="cell">{entry.count}</span>
              <span role="cell">{money.format(entry.pccTotal)}</span>
              <span role="cell">{money.format(entry.metroTotal)}</span>
              <span className={entry.winner === "PCC" ? "category-win-pcc" : "category-win-metro"} role="cell">
                {entry.winner === "PCC" ? "PCC" : "Metro"} by {money.format(Math.abs(entry.difference))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="products-section" id="products" aria-labelledby="products-heading">
        <div className="content-section products-inner">
          <div className="section-intro split-intro product-intro">
            <div>
              <p className="eyebrow">The complete comparison</p>
              <h2 id="products-heading">Every product. Both prices.</h2>
            </div>
            <p>Exact matches use the same Instacart product ID and listed size. Open either price to view that product at the corresponding store.</p>
          </div>

          <div className="filter-panel">
            <label className="search-control">
              <span className="sr-only">Search products</span>
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search all 298 products…" />
            </label>
            <label className="select-control">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="select-control">
              <span>Winner</span>
              <select value={winner} onChange={(event) => setWinner(event.target.value as WinnerFilter)}>
                <option value="all">Either store</option>
                <option value="pcc">PCC</option>
                <option value="metro">Metro</option>
                <option value="tie">Ties</option>
              </select>
            </label>
            <label className="select-control">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                <option value="pcc-advantage">Biggest PCC advantage</option>
                <option value="metro-advantage">Biggest Metro advantage</option>
                <option value="name">Product name</option>
                <option value="category">Category</option>
                <option value="pcc-price">PCC price: low to high</option>
                <option value="metro-price">Metro price: low to high</option>
              </select>
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={promotionsOnly} onChange={(event) => setPromotionsOnly(event.target.checked)} />
              <span>Promotions only</span>
            </label>
          </div>

          <div className="results-heading">
            <p><strong>{filtered.length}</strong> {filtered.length === 1 ? "product" : "products"}</p>
            {(query || category !== "All categories" || winner !== "all" || promotionsOnly) && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>

          <div className="product-list">
            {filtered.map((item) => <ProductCard item={item} key={item.id} />)}
            {filtered.length === 0 && (
              <div className="empty-state">
                <h3>No exact matches found</h3>
                <p>Try clearing a filter or using a broader product name.</p>
                <button type="button" onClick={resetFilters}>Show all products</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <p className="eyebrow">Methodology</p>
          <h2>A same-place, same-time snapshot.</h2>
        </div>
        <div className="footer-copy">
          <p>{data.metadata.methodology}</p>
          <p>{data.metadata.caveat} Delivery address used: {data.metadata.deliveryAddress}.</p>
          <a href="/pcc-vs-metro-prices.csv" download>Download all 298 rows as CSV <ArrowIcon /></a>
        </div>
      </footer>
    </main>
  );
}
