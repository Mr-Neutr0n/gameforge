import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    default: "GameForge — AI Game Builder",
    template: "%s — GameForge",
  },
  description:
    "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "GameForge",
    title: "GameForge — AI Game Builder",
    description:
      "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GameForge — AI Game Builder",
    description:
      "Describe a game, play it in seconds. AI-powered Phaser.js game generation using multi-agent orchestration.",
  },
  robots: {
    index: true,
    follow: true,
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
    name: "GameForge",
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
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
