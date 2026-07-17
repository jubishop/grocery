import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://west-seattle-grocery-prices.jubishop.chatgpt.site"),
  title: "West Seattle Grocery Index — Five-store price comparison",
  description:
    "A source-transparent July 2026 comparison of matched grocery prices across PCC, Metropolitan Market, Safeway, QFC, and Whole Foods in West Seattle.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "West Seattle Grocery Index",
    description: "Compare exact grocery products across five West Seattle stores, with direct source labels on every price.",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "An illustrated five-store grocery price comparison ledger surrounded by varied groceries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "West Seattle Grocery Index",
    description: "Compare exact grocery products across five West Seattle stores, with direct source labels on every price.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
