import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://games.harikp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Game Builder — AI Game Builder",
    template: "%s — Game Builder",
  },
  description:
    "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Game Builder",
    title: "Game Builder — AI Game Builder",
    description:
      "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
    images: [
      {
        url: "https://games.harikp.com/og.jpeg",
        width: 1200,
        height: 630,
        alt: "Game Builder — AI Game Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Builder — AI Game Builder",
    description:
      "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
    images: ["https://games.harikp.com/og.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "theme-color": "#0f0e0b",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Game Builder",
    url: SITE_URL,
    description:
      "AI-powered game builder that generates playable Phaser.js browser games from text descriptions using multi-agent orchestration.",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    author: {
      "@type": "Person",
      name: "Hari KP",
      url: "https://harikp.com",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" href="/icon-192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icon-512.png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
