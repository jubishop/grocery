"use client";

import { useEffect, useState } from "react";
import GroceryExplorer, { type Dataset } from "./GroceryExplorer";

export default function GroceryExplorerLoader() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);

    fetch("/site-data.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Price data request failed with ${response.status}`);
        return response.json() as Promise<Dataset>;
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
            : "Preparing matched products across five West Seattle stores…"}
        </p>
        {error
          ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          : <span className="data-loader-pulse" aria-hidden="true" />}
      </div>
    </main>
  );
}
