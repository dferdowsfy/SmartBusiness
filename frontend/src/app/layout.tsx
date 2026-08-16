import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./validador.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartPR — Regulatory compliance workspace",
  description:
    "Manage business formations, regulatory filings, evidence, readiness, renewals, and due dates in one compliance portfolio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
