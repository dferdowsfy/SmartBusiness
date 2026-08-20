import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import "./validador.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "SmartPR — Puerto Rico Business Licensing & Permitting",
  description:
    "Understand and prepare the permits, licenses, forms and regulatory requirements needed to start and manage a business in Puerto Rico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
