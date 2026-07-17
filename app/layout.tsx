import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "West Seattle Grocery Index — PCC, Metro, Safeway & QFC",
  description:
    "A July 2026 Instacart comparison of 1,381 exact-match products across PCC Community Markets, Metropolitan Market, Safeway, and QFC in West Seattle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
