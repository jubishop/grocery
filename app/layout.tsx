import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCC vs. Metropolitan Market — 298-item price check",
  description:
    "A July 2026 Instacart price comparison of 298 exact products at PCC Community Markets and Metropolitan Market in Seattle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
