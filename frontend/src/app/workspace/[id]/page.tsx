"use client";

import { useParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function WorkspacePage() {
  const params = useParams();
  const gameId = params.id as string;

  return (
    <ProtectedRoute>
      <AppLayout
        sidebar={<WorkspaceSidebar gameId={gameId} />}
      >
        <GamePreviewArea />
      </AppLayout>
    </ProtectedRoute>
  );
}

function WorkspaceSidebar({ gameId }: { gameId: string }) {
  return (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <span className="rounded-md bg-card px-2 py-0.5 font-mono text-xs text-muted">
          {gameId.slice(0, 8)}
        </span>
      </div>

      {/* Activity feed area - will be populated by ActivityFeed component later */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-card-border">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted"
              >
                <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <p className="text-sm text-muted">
              Activity will appear here
              <br />
              once generation starts
            </p>
          </div>
        </div>
      </div>

      {/* Message input area - will be populated by MessageInput component later */}
      <div className="border-t border-card-border p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Send a message..."
            className="flex-1 rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan/30"
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

function GamePreviewArea() {
  return (
    <div className="flex h-full flex-col">
      {/* Preview toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-card-border px-3 sm:h-12 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-foreground">Preview</h3>
          <span className="hidden rounded-md bg-card px-2 py-0.5 text-xs text-muted border border-card-border sm:inline-flex">
            Game
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Play/Pause/Restart controls - will be functional with GamePreview component */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            title="Restart game"
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
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            title="Open in new tab"
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Game preview iframe area */}
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0a] p-3 sm:p-4">
        <div className="flex flex-col items-center gap-4 text-center">
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
              <polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No game loaded</p>
            <p className="mt-1 text-xs text-muted">
              Generate a game to see it here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
