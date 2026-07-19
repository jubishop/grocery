import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://west-seattle-grocery-prices.jubishop.chatgpt.site"),
  title: "West Seattle Grocery Index — Five core catalogs + Trader Joe’s",
  description:
    "Search five core West Seattle grocery catalogs plus Trader Joe’s published catalog, with only strict cross-store matches compared.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "West Seattle Grocery Index",
    description: "Search five core West Seattle grocery catalogs plus Trader Joe’s published catalog, with only strict cross-store matches compared.",
    type: "website",
    url: "/",
    images: [{ url: "/og-diet-v2.png", width: 1731, height: 909, alt: "West Seattle Grocery Index dietary filters and multi-store baskets, surrounded by varied groceries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "West Seattle Grocery Index",
    description: "Search five core West Seattle grocery catalogs plus Trader Joe’s published catalog, with only strict cross-store matches compared.",
    images: ["/og-diet-v2.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
