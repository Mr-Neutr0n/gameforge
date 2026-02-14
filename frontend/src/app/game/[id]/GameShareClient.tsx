"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GamePreview from "@/components/GamePreview";
import {
  getPublicGame,
  getPublicAuditSummary,
  type PublicGame,
  type PublicAuditSummary,
} from "@/lib/api";

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
  const [auditSummary, setAuditSummary] = useState<PublicAuditSummary | null>(
    null,
  );

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

  // Fetch public audit summary
  useEffect(() => {
    let cancelled = false;
    getPublicAuditSummary(gameId)
      .then((data) => {
        if (!cancelled) setAuditSummary(data);
      })
      .catch(() => {});
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
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
          <p className="text-sm text-text-tertiary">Loading game...</p>
        </div>
      </div>
    );
  }

  // Error / 404 state
  if (error || !game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="mx-4 flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-1 border border-border-default">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-tertiary"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <div>
            <h1 className="mb-2 text-xl font-semibold text-text-primary">
              Game Not Found
            </h1>
            <p className="text-sm text-text-tertiary">
              {error ||
                "This game doesn't exist or isn't publicly shared."}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent-muted px-4 py-2 text-xs font-medium text-accent border border-accent/20 transition-all duration-150 hover:bg-accent-subtle"
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
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="mx-4 flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-1 border border-border-default">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-tertiary"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className="mb-2 text-xl font-semibold text-text-primary">
              Game In Progress
            </h1>
            <p className="text-sm text-text-tertiary">
              This game is still being generated. Check back soon!
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent-muted px-4 py-2 text-xs font-medium text-accent border border-accent/20 transition-all duration-150 hover:bg-accent-subtle"
          >
            Go to GameForge
          </Link>
        </div>
      </div>
    );
  }

  const title = game.title || "Untitled Game";

  // Fullscreen mode -- game only
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-0">
        <GamePreview gameCode={game.game_code} />
        {/* Exit fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1/80 backdrop-blur-sm border border-border-default text-text-tertiary transition-all duration-150 hover:bg-surface-1 hover:text-text-primary"
          title="Exit fullscreen (Esc)"
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
    <div className="flex min-h-screen flex-col bg-surface-0">
      {/* Header bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-text-tertiary transition-colors duration-150 ease-in-out hover:text-text-primary"
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 ease-in-out hover:bg-surface-1 hover:text-text-primary"
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
        {/* Game preview -- takes most of the space */}
        <div className="flex-1 min-h-[60vh] lg:min-h-0">
          <GamePreview gameCode={game.game_code} />
        </div>

        {/* Info sidebar */}
        <div className="w-full shrink-0 border-t border-border-default lg:w-80 lg:border-l lg:border-t-0">
          <div className="p-5 sm:p-6">
            {/* Title */}
            <h1 className="mb-2 text-lg font-semibold font-display text-text-primary leading-snug">
              {title}
            </h1>

            {/* Description */}
            {game.description && (
              <p className="mb-4 text-sm leading-relaxed text-text-tertiary">
                {game.description}
              </p>
            )}

            {/* Creator + date */}
            <div className="mb-6 flex flex-col gap-2">
              {game.creator_name && (
                <div className="flex items-center gap-2 text-sm text-text-tertiary">
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
              <div className="flex items-center gap-2 text-sm text-text-tertiary">
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

            {/* Quality badge -- shown only if score > 80 */}
            {auditSummary &&
              auditSummary.has_audits &&
              auditSummary.overall_score > 80 && (
                <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-green-400/5 p-3 border border-green-400/20">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-400/10">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-400"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400">
                      Quality Verified
                    </p>
                    <p className="text-xs text-text-tertiary tabular-nums">
                      Score: {auditSummary.overall_score}/100
                    </p>
                  </div>
                </div>
              )}

            {/* Divider */}
            <div className="mb-5 border-t border-border-default" />

            {/* Made with GameForge badge */}
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl bg-surface-1 p-3.5 border border-border-default transition-colors duration-150 ease-in-out hover:border-accent/20 hover:bg-surface-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Made with GameForge
                </p>
                <p className="text-xs text-text-tertiary">
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
