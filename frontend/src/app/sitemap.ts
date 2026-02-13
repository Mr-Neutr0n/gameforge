import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://games.harikp.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PublicGame {
  id: string;
  updated_at?: string;
  created_at: string;
}

async function fetchPublicGames(): Promise<PublicGame[]> {
  try {
    const res = await fetch(`${API_URL}/api/games/public`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicGames = await fetchPublicGames();

  const gameEntries: MetadataRoute.Sitemap = publicGames.map((game) => ({
    url: `${BASE_URL}/game/${game.id}`,
    lastModified: game.updated_at || game.created_at,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...gameEntries,
  ];
}
