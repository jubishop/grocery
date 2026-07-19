"use client";

import { useEffect, useState } from "react";
import GroceryExplorer, { type Dataset } from "./GroceryExplorer";

type DatasetManifest = Omit<Dataset, "products"> & {
  products?: Dataset["products"];
  productChunks?: string[];
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Price data request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export default function GroceryExplorerLoader() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);

    fetchJson<DatasetManifest>("/site-data.json", controller.signal)
      .then(async (manifest) => {
        const { productChunks = [], products, ...metadata } = manifest;
        if (products) return { ...metadata, products } as Dataset;
        if (productChunks.length === 0) throw new Error("Price data manifest has no product chunks");
        const chunks = await Promise.all(
          productChunks.map((url) => fetchJson<Dataset["products"]>(url, controller.signal)),
        );
        return { ...metadata, products: chunks.flat() } as Dataset;
      })
      .then((nextData) => {
        setData(nextData);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(true);
      });

    return () => controller.abort();
  }, [attempt]);

  if (data) return <GroceryExplorer data={data} />;

  return (
    <main className="data-loader">
      <div className="data-loader-card" aria-live="polite">
        <p className="eyebrow">West Seattle Grocery Index</p>
        <h1>{error ? "The price file didn’t load." : "Loading the latest price map."}</h1>
        <p>
          {error
            ? "The site is online, but its grocery data could not be downloaded. Please try once more."
            : "Preparing five core West Seattle catalogs plus Trader Joe’s published catalog…"}
        </p>
        {error
          ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          : <span className="data-loader-pulse" aria-hidden="true" />}
      </div>
    </main>
  );
}
