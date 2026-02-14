"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface MessageInputProps {
  isGenerating: boolean;
  hasGameCode: boolean;
  onSend: (message: string) => void;
}

export default function MessageInput({
  isGenerating,
  hasGameCode,
  onSend,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canSend = message.trim().length > 0 && !isGenerating && hasGameCode;

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isGenerating || !hasGameCode) return;
    onSend(trimmed);
    setMessage("");
  }, [message, isGenerating, hasGameCode, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [message]);

  // Focus input when generation completes
  useEffect(() => {
    if (!isGenerating && hasGameCode) {
      inputRef.current?.focus();
    }
  }, [isGenerating, hasGameCode]);

  const placeholder = isGenerating
    ? "Agent is working..."
    : hasGameCode
      ? "Describe changes to your game..."
      : "Generate a game first...";

  const isDisabled = isGenerating || !hasGameCode;

  return (
    <div className="border-t border-border-default p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent transition-colors duration-150 ease-in-out hover:bg-accent-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {isGenerating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
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
          )}
        </button>
      </div>
      {!isDisabled && (
        <p className="mt-1.5 text-[10px] text-text-quaternary">
          Press{" "}
          <kbd className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-text-quaternary border border-border-default">
            Enter
          </kbd>{" "}
          to send,{" "}
          <kbd className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-text-quaternary border border-border-default">
            Shift+Enter
          </kbd>{" "}
          for new line
        </p>
      )}
    </div>
  );
}
