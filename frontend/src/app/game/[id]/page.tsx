import { Metadata } from "next";
import GameShareClient from "./GameShareClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://games.harikp.com";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchPublicGame(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/games/${id}/public`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const game = await fetchPublicGame(id);

  if (!game) {
    return {
      title: "Game Not Found",
      description: "This game does not exist or is not publicly shared.",
      robots: { index: false, follow: false },
    };
  }

  const title = game.title || "Untitled Game";
  const description =
    game.description ||
    game.prompt ||
    `A game created with GameForge by ${game.creator_name || "a creator"}`;
  const gameUrl = `${SITE_URL}/game/${id}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — GameForge`,
      description,
      type: "website",
      url: gameUrl,
      siteName: "GameForge",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — GameForge`,
      description,
    },
    alternates: {
      canonical: gameUrl,
    },
  };
}

export default async function GameSharePage({ params }: PageProps) {
  const { id } = await params;
  return <GameShareClient gameId={id} />;
}
