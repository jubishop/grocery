import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "West Seattle Grocery Index — Five-store price comparison",
  description:
    "A July 2026 comparison of matched grocery prices across PCC, Metropolitan Market, Safeway, QFC, and Whole Foods in West Seattle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
