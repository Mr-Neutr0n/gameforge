"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GamePreview from "@/components/GamePreview";
import { getPublicGame, type PublicGame } from "@/lib/api";

interface GameShareClientProps {
  gameId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function GameShareClient({ gameId }: GameShareClientProps) {
  const [game, setGame] = useState<PublicGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getPublicGame(gameId);
        if (!cancelled) {
          setGame(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load game"
          );
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-cyan/20 border-t-accent-cyan" />
          <p className="text-sm text-muted">Loading game...</p>
        </div>
      </div>
    );
  }

  // Error / 404 state
  if (error || !game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-4 flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-card-border">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Game Not Found
            </h1>
            <p className="text-sm text-muted">
              {error ||
                "This game doesn't exist or isn't publicly shared."}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent-cyan/10 px-5 py-2.5 text-sm font-medium text-accent-cyan border border-accent-cyan/20 transition-colors hover:bg-accent-cyan/20"
          >
            Go to GameForge
          </Link>
        </div>
      </div>
    );
  }

  // No game code
  if (!game.game_code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-4 flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-card-border">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Game In Progress
            </h1>
            <p className="text-sm text-muted">
              This game is still being generated. Check back soon!
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent-cyan/10 px-5 py-2.5 text-sm font-medium text-accent-cyan border border-accent-cyan/20 transition-colors hover:bg-accent-cyan/20"
          >
            Go to GameForge
          </Link>
        </div>
      </div>
    );
  }

  const title = game.title || "Untitled Game";

  // Fullscreen mode — game only
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
        <GamePreview gameCode={game.game_code} />
        {/* Exit fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm border border-card-border text-muted transition-all hover:bg-card hover:text-foreground"
          title="Exit fullscreen (Esc)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    );
  }

  // Normal view
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-card-border px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted transition-colors hover:text-foreground"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">
            GameForge
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            title="Fullscreen"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Game area */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Game preview — takes most of the space */}
        <div className="flex-1 min-h-[60vh] lg:min-h-0">
          <GamePreview gameCode={game.game_code} />
        </div>

        {/* Info sidebar */}
        <div className="w-full shrink-0 border-t border-card-border lg:w-80 lg:border-l lg:border-t-0">
          <div className="p-5 sm:p-6">
            {/* Title */}
            <h1 className="mb-2 text-lg font-semibold text-foreground leading-snug">
              {title}
            </h1>

            {/* Description */}
            {game.description && (
              <p className="mb-4 text-sm leading-relaxed text-muted">
                {game.description}
              </p>
            )}

            {/* Creator + date */}
            <div className="mb-6 flex flex-col gap-2">
              {game.creator_name && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{game.creator_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{formatDate(game.created_at)}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="mb-5 border-t border-card-border" />

            {/* Made with GameForge badge */}
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl bg-card p-3.5 border border-card-border transition-colors hover:border-accent-cyan/20 hover:bg-card/80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-cyan/10">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent-cyan"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Made with GameForge
                </p>
                <p className="text-xs text-muted">
                  Create your own game with AI
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
