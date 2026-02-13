"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { getMyGames, type Game } from "@/lib/api";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const GAME_TYPE_COLORS: Record<string, string> = {
  platformer: "#22d3ee",
  shooter: "#a855f7",
  topdown: "#3b82f6",
  puzzle: "#f59e0b",
  custom: "#737373",
};

function getGameColor(prompt: string | null): string {
  if (!prompt) return GAME_TYPE_COLORS.custom;
  const lower = prompt.toLowerCase();
  if (lower.includes("platform") || lower.includes("jump")) return GAME_TYPE_COLORS.platformer;
  if (lower.includes("shoot") || lower.includes("space") || lower.includes("blast")) return GAME_TYPE_COLORS.shooter;
  if (lower.includes("dungeon") || lower.includes("top-down") || lower.includes("rpg") || lower.includes("explore")) return GAME_TYPE_COLORS.topdown;
  if (lower.includes("puzzle") || lower.includes("match") || lower.includes("grid")) return GAME_TYPE_COLORS.puzzle;
  return GAME_TYPE_COLORS.custom;
}

function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const color = getGameColor(game.prompt);

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card text-left transition-all hover:border-white/10 hover:bg-white/[0.03]"
    >
      {/* Thumbnail placeholder */}
      <div
        className="flex h-36 items-center justify-center"
        style={{ backgroundColor: `${color}06` }}
      >
        {game.game_code ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg"
              style={{ backgroundColor: `${color}25`, border: `2px solid ${color}50` }}
            />
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full"
                  style={{
                    width: `${10 + i * 6}px`,
                    backgroundColor: `${color}${i % 2 === 0 ? "30" : "18"}`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="text-[10px] text-muted">No preview</span>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              game.is_public
                ? "bg-accent-cyan/10 text-accent-cyan"
                : "bg-white/[0.04] text-muted"
            }`}
          >
            {game.is_public ? "Public" : "Private"}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
          {game.title || "Untitled Game"}
        </h3>

        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
          {game.description || game.prompt || "No description"}
        </p>

        <div className="mt-auto pt-3">
          <span className="text-[11px] text-muted/60">{formatDate(game.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

function DashboardSidebar({ gameCount }: { gameCount: number }) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Dashboard</h2>
        <p className="mt-1 text-xs text-muted">Your game library</p>
      </div>

      <div className="rounded-xl border border-card-border bg-white/[0.02] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-cyan/10">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-cyan"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{gameCount}</p>
            <p className="text-[11px] text-muted">
              {gameCount === 1 ? "Game" : "Games"} created
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-card-border bg-white/[0.02] p-3">
          <p className="text-xs text-muted leading-relaxed">
            Create games from text prompts using AI. Each game is a playable
            Phaser.js project you can iterate on and share.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateGame }: { onCreateGame: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-card-border bg-card">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 12h4" />
            <path d="M8 10v4" />
            <circle cx="15" cy="11" r="1" />
            <circle cx="18" cy="13" r="1" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            No games yet
          </h3>
          <p className="mt-1 text-sm text-muted">
            Create your first one.
          </p>
        </div>
        <button
          onClick={onCreateGame}
          className="mt-2 flex items-center gap-2 rounded-xl bg-accent-cyan px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Game
        </button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      try {
        const data = await getMyGames();
        if (!cancelled) {
          // Sort by newest first
          const sorted = [...data].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
          setGames(sorted);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load games",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGames();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateGame = () => {
    router.push("/create");
  };

  const handleOpenGame = (gameId: string) => {
    router.push(`/workspace/${gameId}`);
  };

  if (loading) {
    return (
      <AppLayout sidebar={<DashboardSidebar gameCount={0} />}>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
            <p className="text-sm text-muted">Loading games...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout sidebar={<DashboardSidebar gameCount={0} />}>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-muted">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-accent-cyan hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (games.length === 0) {
    return (
      <AppLayout sidebar={<DashboardSidebar gameCount={0} />}>
        <EmptyState onCreateGame={handleCreateGame} />
      </AppLayout>
    );
  }

  return (
    <AppLayout sidebar={<DashboardSidebar gameCount={games.length} />}>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-border px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">My Games</h1>
            <p className="text-xs text-muted">
              {games.length} {games.length === 1 ? "game" : "games"}
            </p>
          </div>
          <button
            onClick={handleCreateGame}
            className="flex items-center gap-2 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Game
          </button>
        </div>

        {/* Game grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onClick={() => handleOpenGame(game.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
