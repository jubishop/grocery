import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://west-seattle-grocery-prices.jubishop.chatgpt.site"),
  title: "West Seattle Grocery Index — Five-store price comparison",
  description:
    "Build a grocery basket and compare complete totals across PCC, Metropolitan Market, Safeway, QFC, and Whole Foods in West Seattle.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "West Seattle Grocery Index",
    description: "Build your actual grocery basket and find the cheapest complete total across five West Seattle stores.",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "An illustrated five-store grocery price comparison ledger surrounded by varied groceries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "West Seattle Grocery Index",
    description: "Build your actual grocery basket and find the cheapest complete total across five West Seattle stores.",
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
