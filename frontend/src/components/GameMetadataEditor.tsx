"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GameMetadataEditorProps {
  description: string | null;
  isPublic: boolean;
  onDescriptionChange: (description: string) => void;
  onVisibilityChange: (isPublic: boolean) => void;
}

export default function GameMetadataEditor({
  description,
  isPublic,
  onDescriptionChange,
  onVisibilityChange,
}: GameMetadataEditorProps) {
  const [editDescription, setEditDescription] = useState(description || "");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const descriptionDirty = editDescription !== (description || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when prop changes externally
  useEffect(() => {
    setEditDescription(description || "");
  }, [description]);

  // Debounced description save
  const debounceSave = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setIsSavingDescription(true);
        onDescriptionChange(value);
        // Small delay to show saving indicator
        setTimeout(() => setIsSavingDescription(false), 400);
      }, 800);
    },
    [onDescriptionChange],
  );

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value);
    debounceSave(value);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="shrink-0 border-b border-border-default bg-surface-0">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-4">
        {/* Description */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="game-description"
              className="text-xs font-medium text-text-tertiary"
            >
              Description
            </label>
            {isSavingDescription && (
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                Saving...
              </span>
            )}
            {!isSavingDescription && !descriptionDirty && description && (
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Saved
              </span>
            )}
          </div>
          <textarea
            id="game-description"
            value={editDescription}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Add a description for your game..."
            rows={2}
            className="w-full resize-none rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary outline-none transition-colors duration-150 ease-in-out focus:border-accent/40"
          />
        </div>

        {/* Visibility toggle */}
        <div className="flex flex-col gap-1.5 sm:w-44">
          <label className="text-xs font-medium text-text-tertiary">Visibility</label>
          <div className="flex rounded-lg border border-border-default bg-surface-1">
            <button
              onClick={() => {
                if (isPublic) onVisibilityChange(false);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-l-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ease-in-out ${
                !isPublic
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Private
            </button>
            <button
              onClick={() => {
                if (!isPublic) onVisibilityChange(true);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-r-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ease-in-out ${
                isPublic
                  ? "bg-green-500/10 text-green-400"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
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
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Public
            </button>
          </div>
          <p className="text-[10px] text-text-quaternary">
            {isPublic
              ? "Anyone with the link can play this game"
              : "Only you can access this game"}
          </p>
        </div>
      </div>
    </div>
  );
}
