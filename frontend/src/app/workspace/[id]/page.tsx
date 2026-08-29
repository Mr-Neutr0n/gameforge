"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import GamePreview from "@/components/GamePreview";
import ActivityFeed from "@/components/ActivityFeed";
import ConversationHistory from "@/components/ConversationHistory";
import ProtectedRoute from "@/components/ProtectedRoute";
import MessageInput from "@/components/MessageInput";
import GameMetadataEditor from "@/components/GameMetadataEditor";
import QualityPanel from "@/components/QualityPanel";
import { useToast } from "@/components/Toast";
import {
  getGame,
  updateGame,
  streamGameGeneration,
  streamGameIteration,
  type SSEEvent,
  type Conversation,
  type GameWithConversation,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
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
  const [gameDescription, setGameDescription] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [auditData, setAuditData] = useState<{
    overall_score: number;
    overall_passed: boolean;
    audits: Record<string, { passed: boolean; score: number }>;
  } | null>(null);

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
        setGameDescription(g.description || null);
        setIsPublic(g.is_public);
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
      trackEvent("game_generation_started", {
        template: templateType || "custom",
      });

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
            // Capture audit results from SSE
            if (event.type === "audit" && event.audits) {
              setAuditData({
                overall_score: event.overall_score ?? 0,
                overall_passed: event.overall_passed ?? false,
                audits: event.audits,
              });
            }
          },
          onError: (err) => {
            setGenerateError(err.message);
            showToast(err.message, "error");
            trackEvent("game_generation_failed");
            setIsGenerating(false);
          },
          onComplete: () => {
            setIsGenerating(false);
            // Backend auto-saves after generation — mark as saved
            setHasUnsavedChanges(false);
            setLastSavedAt(Date.now());
            showToast("Game generated successfully", "success");
            trackEvent("game_generation_completed");
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
    [gameId, isGenerating, showToast],
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
      trackEvent("game_iteration_started");

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
          // Capture audit results from SSE
          if (event.type === "audit" && event.audits) {
            setAuditData({
              overall_score: event.overall_score ?? 0,
              overall_passed: event.overall_passed ?? false,
              audits: event.audits,
            });
          }
        },
        onError: (err) => {
          setGenerateError(err.message);
          showToast(err.message, "error");
          trackEvent("game_iteration_failed");
          setIsGenerating(false);
        },
        onComplete: () => {
          setIsGenerating(false);
          // Backend auto-saves after iteration — mark as saved
          setHasUnsavedChanges(false);
          setLastSavedAt(Date.now());
          showToast("Game updated successfully", "success");
          trackEvent("game_iteration_completed");
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
    [gameId, isGenerating, showToast],
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save game", "error");
    } finally {
      setIsSaving(false);
    }
  }, [gameId, gameCode, isSaving, showToast]);

  // Metadata update handler — persists title, description, visibility
  const handleMetadataUpdate = useCallback(
    async (updates: { title?: string; description?: string; is_public?: boolean }) => {
      try {
        const updated = await updateGame(gameId, updates);
        if (updates.title !== undefined) setGameTitle(updated.title);
        if (updates.description !== undefined) setGameDescription(updated.description);
        if (updates.is_public !== undefined) setIsPublic(updated.is_public);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to update game", "error");
      }
    },
    [gameId, showToast],
  );

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
            isPublic={isPublic}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            showMetadataPanel={showMetadataPanel}
            onSave={handleSave}
            onTitleChange={(title) => handleMetadataUpdate({ title })}
            onToggleMetadataPanel={() => setShowMetadataPanel((v) => !v)}
          />
        )}
        {/* Metadata editor panel */}
        {gameCode && showMetadataPanel && (
          <GameMetadataEditor
            description={gameDescription}
            isPublic={isPublic}
            onDescriptionChange={(description) =>
              handleMetadataUpdate({ description })
            }
            onVisibilityChange={(is_public) =>
              handleMetadataUpdate({ is_public })
            }
          />
        )}
        {/* Quality audit panel */}
        {gameCode && (
          <QualityPanel gameId={gameId} sseAuditData={auditData} />
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
      <div className="flex items-center justify-between border-b border-border-default p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-text-primary">Activity</h2>
        <span className="rounded-full bg-surface-1 px-2 py-0.5 font-mono text-[10px] font-medium text-text-tertiary">
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
        <div className="border-t border-border-default p-3 sm:p-4">
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
  isPublic,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  showMetadataPanel,
  onSave,
  onTitleChange,
  onToggleMetadataPanel,
}: {
  title: string | null;
  isPublic: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  showMetadataPanel: boolean;
  onSave: () => void;
  onTitleChange: (title: string) => void;
  onToggleMetadataPanel: () => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || "");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync editTitle when title prop changes (e.g., after generation)
  useEffect(() => {
    if (!isEditingTitle) {
      setEditTitle(title || "");
    }
  }, [title, isEditingTitle]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSubmit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    } else {
      setEditTitle(title || "");
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === "Escape") {
      setEditTitle(title || "");
      setIsEditingTitle(false);
    }
  };

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
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default bg-surface-0 px-3 sm:px-4">
      {/* Title -- click to edit */}
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
          className="shrink-0 text-accent"
        >
          <polygon
            points="5 3 19 12 5 21 5 3"
            strokeLinejoin="round"
          />
        </svg>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="w-48 truncate rounded-lg border border-border-active bg-surface-1 px-1.5 py-0.5 text-sm font-medium text-text-primary outline-none focus:border-accent sm:w-64"
            maxLength={255}
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="group flex items-center gap-1.5 truncate"
            title="Click to edit title"
          >
            <span className="truncate text-sm font-medium text-text-primary">
              {title || "Untitled Game"}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}

        {/* Visibility badge */}
        <span
          className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${
            isPublic
              ? "bg-green-500/10 text-green-400"
              : "bg-surface-3 text-text-tertiary"
          }`}
        >
          {isPublic ? "Public" : "Private"}
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Metadata panel toggle */}
        <button
          onClick={onToggleMetadataPanel}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ease-in-out border ${
            showMetadataPanel
              ? "border-accent/30 bg-accent-muted text-accent"
              : "border-border-default bg-surface-1 text-text-primary hover:bg-surface-2 hover:border-border-hover"
          }`}
          title="Edit game details"
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">Details</span>
        </button>

        {/* Save status indicator */}
        <span className="hidden text-xs text-text-tertiary sm:inline-flex items-center gap-1.5">
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
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed bg-surface-2 border border-border-default text-text-primary hover:bg-surface-3 hover:border-border-hover"
          title={
            isSaving
              ? "Saving..."
              : hasUnsavedChanges
                ? "Save game (Ctrl+S)"
                : "All changes saved"
          }
        >
          {isSaving ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-text-tertiary border-t-text-primary" />
          ) : (
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
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-border-default px-3 sm:h-12 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-text-primary">Game</h3>
          <span className="hidden items-center gap-1.5 rounded-full bg-surface-1 px-2 py-0.5 text-[10px] font-medium text-text-tertiary border border-border-default sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
            Idle
          </span>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center bg-surface-0 p-3 sm:p-4">
        <div className="flex flex-col items-center gap-5 text-center">
          {isGenerating ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-1 border border-border-default">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Loading...
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Watch the activity feed for progress
                </p>
                {elapsed >= 120 && (
                  <p className="mt-2 text-xs text-text-tertiary animate-pulse">
                    Taking longer than expected...
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-1 border border-border-default">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-tertiary"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Ready to generate
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Your game will appear here
                </p>
              </div>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-[var(--surface-0)] transition-all duration-150 hover:bg-accent-hover"
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
