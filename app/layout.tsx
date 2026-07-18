import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://west-seattle-grocery-prices.jubishop.chatgpt.site"),
  title: "West Seattle Grocery Index — Five full catalogs + Trader Joe’s",
  description:
    "Compare five full West Seattle grocery catalogs plus strict Trader Joe’s commodity matches.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "West Seattle Grocery Index",
    description: "Build a grocery basket across five full West Seattle catalogs, with Trader Joe’s added where strict commodity matches exist.",
    type: "website",
    url: "/",
    images: [{ url: "/og-diet-v2.png", width: 1731, height: 909, alt: "West Seattle Grocery Index dietary filters and multi-store baskets, surrounded by varied groceries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "West Seattle Grocery Index",
    description: "Build a grocery basket across five full West Seattle catalogs, with Trader Joe’s added where strict commodity matches exist.",
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
