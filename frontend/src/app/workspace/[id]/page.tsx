"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import GamePreview from "@/components/GamePreview";
import ActivityFeed from "@/components/ActivityFeed";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  getGame,
  streamGameGeneration,
  type SSEEvent,
  type GameWithConversation,
} from "@/lib/api";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameWithConversation | null>(null);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasStartedGeneration = useRef(false);

  // Load game data on mount
  useEffect(() => {
    let cancelled = false;
    getGame(gameId)
      .then((g) => {
        if (cancelled) return;
        setGame(g);
        if (g.game_code) {
          setGameCode(g.game_code);
        }
      })
      .catch(() => {
        // Game may not exist yet or user is unauthorized
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // Start generation callback
  const startGeneration = useCallback(
    (prompt: string, templateType?: string) => {
      if (isGenerating) return;

      setIsGenerating(true);
      setStartTime(Date.now());
      setEvents([]);
      setGenerateError(null);

      const controller = streamGameGeneration(
        gameId,
        { prompt, template_type: templateType },
        {
          onEvent: (event: SSEEvent) => {
            setEvents((prev) => [...prev, event]);

            // Update game code in real-time when we get code events
            if (event.type === "code" && event.content) {
              setGameCode(event.content);
            }
            // Final game code on complete
            if (event.type === "complete" && event.game_code) {
              setGameCode(event.game_code);
            }
          },
          onError: (err) => {
            setGenerateError(err.message);
            setIsGenerating(false);
          },
          onComplete: () => {
            setIsGenerating(false);
          },
        },
      );

      abortRef.current = controller;
    },
    [gameId, isGenerating],
  );

  // Auto-start generation if game has a prompt but no code
  useEffect(() => {
    if (hasStartedGeneration.current) return;
    if (!game) return;

    // If game already has code, don't auto-generate
    if (game.game_code) return;

    // If game has a prompt (just created), auto-start generation
    if (game.prompt) {
      hasStartedGeneration.current = true;
      const templateType = searchParams.get("template") || undefined;
      startGeneration(game.prompt, templateType);
    }
  }, [game, searchParams, startGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Manual generate button handler
  const handleGenerate = () => {
    if (!game?.prompt) return;
    startGeneration(game.prompt);
  };

  return (
    <ProtectedRoute>
      <AppLayout
        sidebar={
          <WorkspaceSidebar
            gameId={gameId}
            events={events}
            isGenerating={isGenerating}
            startTime={startTime}
            generateError={generateError}
          />
        }
      >
        {gameCode ? (
          <GamePreview gameCode={gameCode} />
        ) : (
          <GamePreviewEmpty
            isGenerating={isGenerating}
            onGenerate={game?.prompt ? handleGenerate : undefined}
          />
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

function WorkspaceSidebar({
  gameId,
  events,
  isGenerating,
  startTime,
  generateError,
}: {
  gameId: string;
  events: SSEEvent[];
  isGenerating: boolean;
  startTime?: number;
  generateError: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <span className="rounded-md bg-card px-2 py-0.5 font-mono text-xs text-muted">
          {gameId.slice(0, 8)}
        </span>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto">
        <ActivityFeed
          events={events}
          isGenerating={isGenerating}
          startTime={startTime}
        />
      </div>

      {/* Error display */}
      {generateError && (
        <div className="border-t border-card-border p-3 sm:p-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0 text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs text-red-400">{generateError}</p>
          </div>
        </div>
      )}

      {/* Message input area - disabled until generation completes */}
      <div className="border-t border-card-border p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={
              isGenerating ? "Agent is working..." : "Send a message..."
            }
            className="flex-1 rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled
          />
          <button
            disabled
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function GamePreviewEmpty({
  isGenerating,
  onGenerate,
}: {
  isGenerating: boolean;
  onGenerate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-card-border px-3 sm:h-12 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-foreground">Preview</h3>
          <span className="hidden rounded-md bg-card px-2 py-0.5 text-xs text-muted border border-card-border sm:inline-flex">
            Game
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0a] p-3 sm:p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          {isGenerating ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-card-border">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Generating your game...
                </p>
                <p className="mt-1 text-xs text-muted">
                  Watch the activity feed for progress
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-card-border">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-accent-purple"
                >
                  <polygon
                    points="5 3 19 12 5 21 5 3"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No game loaded
                </p>
                <p className="mt-1 text-xs text-muted">
                  Generate a game to see it here
                </p>
              </div>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
