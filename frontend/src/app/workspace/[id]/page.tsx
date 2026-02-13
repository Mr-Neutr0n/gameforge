"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import GamePreview from "@/components/GamePreview";
import ActivityFeed from "@/components/ActivityFeed";
import ConversationHistory from "@/components/ConversationHistory";
import ProtectedRoute from "@/components/ProtectedRoute";
import MessageInput from "@/components/MessageInput";
import {
  getGame,
  updateGame,
  streamGameGeneration,
  streamGameIteration,
  type SSEEvent,
  type Conversation,
  type GameWithConversation,
} from "@/lib/api";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameWithConversation | null>(null);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [gameTitle, setGameTitle] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasStartedGeneration = useRef(false);
  // Track the code that was last saved/loaded from the DB
  const savedCodeRef = useRef<string | null>(null);

  // Load game data on mount
  useEffect(() => {
    let cancelled = false;
    getGame(gameId)
      .then((g) => {
        if (cancelled) return;
        setGame(g);
        setGameTitle(g.title || null);
        if (g.game_code) {
          setGameCode(g.game_code);
          savedCodeRef.current = g.game_code;
        }
        // Load stored conversation history
        if (g.conversations && g.conversations.length > 0) {
          setConversations(g.conversations);
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
            // Backend auto-saves after generation — mark as saved
            setHasUnsavedChanges(false);
            setLastSavedAt(Date.now());
            // Refresh game data (title, conversations) from DB after generation
            getGame(gameId)
              .then((g) => {
                if (g.conversations) setConversations(g.conversations);
                if (g.title) setGameTitle(g.title);
                if (g.game_code) savedCodeRef.current = g.game_code;
                // Clear live events since they're now in stored history
                setEvents([]);
              })
              .catch(() => {});
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

  // Track unsaved changes when gameCode diverges from saved version
  useEffect(() => {
    if (gameCode && savedCodeRef.current !== null && gameCode !== savedCodeRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [gameCode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Iteration handler — sends a user message to modify the existing game
  const handleIterate = useCallback(
    (message: string) => {
      if (isGenerating) return;

      setIsGenerating(true);
      setStartTime(Date.now());
      setGenerateError(null);

      // Add a user message event to the feed
      setEvents((prev) => [
        ...prev,
        {
          type: "thinking" as const,
          agent: "iterator",
          content: message,
        },
      ]);

      const controller = streamGameIteration(gameId, message, {
        onEvent: (event: SSEEvent) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === "code" && event.content) {
            setGameCode(event.content);
          }
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
          // Backend auto-saves after iteration — mark as saved
          setHasUnsavedChanges(false);
          setLastSavedAt(Date.now());
          // Refresh conversation history from DB after iteration
          getGame(gameId)
            .then((g) => {
              if (g.conversations) setConversations(g.conversations);
              if (g.game_code) savedCodeRef.current = g.game_code;
              // Clear live events since they're now in stored history
              setEvents([]);
            })
            .catch(() => {});
        },
      });

      abortRef.current = controller;
    },
    [gameId, isGenerating],
  );

  // Manual save handler — persists current gameCode to DB
  const handleSave = useCallback(async () => {
    if (!gameCode || isSaving) return;
    setIsSaving(true);
    try {
      await updateGame(gameId, { game_code: gameCode });
      savedCodeRef.current = gameCode;
      setHasUnsavedChanges(false);
      setLastSavedAt(Date.now());
    } catch {
      // Save failed — changes remain unsaved
    } finally {
      setIsSaving(false);
    }
  }, [gameId, gameCode, isSaving]);

  // Ctrl+S / Cmd+S keyboard shortcut for save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (gameCode && !isSaving && hasUnsavedChanges) {
          handleSave();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameCode, isSaving, hasUnsavedChanges, handleSave]);

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
            conversations={conversations}
            events={events}
            isGenerating={isGenerating}
            startTime={startTime}
            generateError={generateError}
            hasGameCode={!!gameCode}
            onSendMessage={handleIterate}
          />
        }
      >
        {/* Workspace toolbar with title + save */}
        {gameCode && (
          <WorkspaceToolbar
            title={gameTitle}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            onSave={handleSave}
          />
        )}
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
  conversations,
  events,
  isGenerating,
  startTime,
  generateError,
  hasGameCode,
  onSendMessage,
}: {
  gameId: string;
  conversations: Conversation[];
  events: SSEEvent[];
  isGenerating: boolean;
  startTime?: number;
  generateError: string | null;
  hasGameCode: boolean;
  onSendMessage: (message: string) => void;
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

      {/* Scrollable area for conversation history + live activity feed */}
      <div className="flex-1 overflow-y-auto">
        {/* Stored conversation history from DB */}
        <ConversationHistory conversations={conversations} />

        {/* Real-time activity feed for current session */}
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

      {/* Message input */}
      <MessageInput
        isGenerating={isGenerating}
        hasGameCode={hasGameCode}
        onSend={onSendMessage}
      />
    </div>
  );
}

function WorkspaceToolbar({
  title,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  onSave,
}: {
  title: string | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  onSave: () => void;
}) {
  const formatSavedTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-card-border bg-background px-3 sm:px-4">
      {/* Title */}
      <div className="flex items-center gap-2 overflow-hidden">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-accent-purple"
        >
          <polygon
            points="5 3 19 12 5 21 5 3"
            strokeLinejoin="round"
          />
        </svg>
        <span className="truncate text-sm font-medium text-foreground">
          {title || "Untitled Game"}
        </span>
      </div>

      {/* Save controls */}
      <div className="flex items-center gap-2">
        {/* Save status indicator */}
        <span className="hidden text-xs text-muted sm:inline-flex items-center gap-1.5">
          {isSaving ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
              Saving...
            </>
          ) : hasUnsavedChanges ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Unsaved
            </>
          ) : lastSavedAt ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Saved {formatSavedTime(lastSavedAt)}
            </>
          ) : null}
        </span>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-card border border-card-border text-foreground hover:bg-white/[0.06]"
          title={
            isSaving
              ? "Saving..."
              : hasUnsavedChanges
                ? "Save game (Ctrl+S)"
                : "All changes saved"
          }
        >
          {isSaving ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-foreground" />
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          )}
          Save
        </button>
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
