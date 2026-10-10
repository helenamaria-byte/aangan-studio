import type { Metadata } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

// Figtree for everyday text and figures. Cormorant Garamond, an elegant display serif, for titles and big numbers.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-figtree",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Aangan Studio",
  description: "Every enquiry answered, every consultation booked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${cormorant.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
