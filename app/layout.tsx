import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://west-seattle-grocery-prices.jubishop.chatgpt.site"),
  title: "West Seattle Grocery Index — Five-store price comparison",
  description:
    "Filter by dietary claims, build a grocery basket, and compare complete totals across five West Seattle stores.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "West Seattle Grocery Index",
    description: "Filter by dietary claims, build your actual grocery basket, and find the cheapest complete total across five West Seattle stores.",
    type: "website",
    url: "/",
    images: [{ url: "/og-diet-v2.png", width: 1731, height: 909, alt: "West Seattle Grocery Index dietary filters and five-store baskets, surrounded by varied groceries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "West Seattle Grocery Index",
    description: "Filter by dietary claims, build your actual grocery basket, and find the cheapest complete total across five West Seattle stores.",
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
