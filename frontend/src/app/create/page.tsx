"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { createGame, type CreateGameRequest } from "@/lib/api";

type TemplateType = "platformer" | "topdown" | "shooter" | "puzzle";

interface Template {
  id: TemplateType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  example: string;
}

const TEMPLATES: Template[] = [
  {
    id: "platformer",
    label: "Platformer",
    description: "Side-scrolling with jumping, platforms, and gravity",
    color: "#22d3ee",
    example: "A blue square jumps across green platforms to reach the flag",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="17" width="18" height="3" rx="1" />
        <rect x="7" y="12" width="6" height="2" rx="0.5" />
        <rect x="14" y="8" width="5" height="2" rx="0.5" />
        <rect x="9" y="5" width="3" height="3" rx="0.5" />
        <path d="M10.5 5 L10.5 3" />
      </svg>
    ),
  },
  {
    id: "topdown",
    label: "Top-Down",
    description: "Bird's-eye view with 4-directional movement and exploration",
    color: "#3b82f6",
    example: "Explore a dungeon, avoid enemies, collect keys to unlock doors",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "shooter",
    label: "Shooter",
    description: "Space shooter with enemies, bullets, and scoring",
    color: "#a855f7",
    example: "A spaceship shoots at waves of alien invaders from the bottom",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 10 12 8 9 10 12 2" />
        <line x1="12" y1="10" x2="12" y2="16" />
        <circle cx="6" cy="6" r="1.5" />
        <circle cx="18" cy="4" r="1.5" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="20" cy="10" r="1" />
        <path d="M10 20 L12 22 L14 20" />
      </svg>
    ),
  },
  {
    id: "puzzle",
    label: "Puzzle",
    description: "Grid-based with click interactions, matching, or clearing",
    color: "#f59e0b",
    example: "A match-3 grid where you swap gems to clear rows and score points",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <circle cx="6.5" cy="6.5" r="1.5" />
        <path d="M16 6 L19 6" />
        <path d="M17.5 4.5 L17.5 7.5" />
      </svg>
    ),
  },
];

function CreateSidebar() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Create Game</h2>
        <p className="mt-1 text-xs text-muted">Describe your game idea</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-card-border bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-cyan/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-cyan">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <span className="text-xs font-medium text-foreground">Tips</span>
          </div>
          <ul className="flex flex-col gap-1.5 text-xs text-muted leading-relaxed">
            <li>Be specific about controls and mechanics</li>
            <li>Describe what the player sees and does</li>
            <li>Mention win/lose conditions</li>
            <li>Colors and visual style help too</li>
          </ul>
        </div>

        <div className="rounded-xl border border-card-border bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-purple/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-purple">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="text-xs font-medium text-foreground">How it works</span>
          </div>
          <ol className="flex flex-col gap-1.5 text-xs text-muted leading-relaxed list-decimal list-inside">
            <li>Describe your game idea</li>
            <li>Pick a template (optional)</li>
            <li>AI plans and generates code</li>
            <li>Play and iterate with chat</li>
          </ol>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-card-border bg-white/[0.02] p-3">
          <p className="text-xs text-muted leading-relaxed">
            Games are built with Phaser.js and rendered directly in your browser. No external assets needed — all graphics are drawn with code.
          </p>
        </div>
      </div>
    </div>
  );
}

function CreateContent() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = prompt.trim().length > 0;

  const handleTemplateClick = (template: Template) => {
    if (selectedTemplate === template.id) {
      setSelectedTemplate(null);
    } else {
      setSelectedTemplate(template.id);
      if (!prompt.trim()) {
        setPrompt(template.example);
      }
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || generating) return;

    setGenerating(true);
    setError(null);

    try {
      const data: CreateGameRequest = {
        prompt: prompt.trim(),
      };
      if (selectedTemplate) {
        data.template_type = selectedTemplate;
      }

      const game = await createGame(data);
      router.push(`/workspace/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <AppLayout sidebar={<CreateSidebar />}>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-card-border px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground">New Game</h1>
          <p className="mt-0.5 text-xs text-muted">
            Describe your game and let AI build it
          </p>
        </div>

        <div className="flex flex-1 flex-col px-6 py-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            {/* Prompt input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="game-prompt"
                className="text-sm font-medium text-foreground"
              >
                Game Description
              </label>
              <textarea
                id="game-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your game... e.g., A platformer where a red square jumps across moving platforms over a lava pit. Arrow keys to move and jump. Collect coins for points. 3 lives."
                rows={5}
                disabled={generating}
                className="w-full resize-none rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan/30 disabled:opacity-50"
              />
              <p className="text-xs text-muted">
                Press{" "}
                <kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted border border-card-border">
                  {typeof navigator !== "undefined" &&
                  /Mac/.test(navigator.userAgent)
                    ? "Cmd"
                    : "Ctrl"}
                  +Enter
                </kbd>{" "}
                to generate
              </p>
            </div>

            {/* Template selector */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Template
                </label>
                <span className="text-xs text-muted">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TEMPLATES.map((template) => {
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      disabled={generating}
                      className={`group relative flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all disabled:opacity-50 ${
                        isSelected
                          ? "border-white/20 bg-white/[0.04]"
                          : "border-card-border bg-card hover:border-white/10 hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div
                          className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ backgroundColor: template.color }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#0c0c0c"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      {/* Icon */}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                        style={{
                          backgroundColor: `${template.color}${isSelected ? "20" : "10"}`,
                          color: template.color,
                        }}
                      >
                        {template.icon}
                      </div>

                      {/* Label */}
                      <span
                        className={`text-xs font-medium ${
                          isSelected ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {template.label}
                      </span>

                      {/* Description - visible on hover or when selected */}
                      <span
                        className={`text-[10px] leading-tight ${
                          isSelected
                            ? "text-muted"
                            : "text-muted/60 opacity-0 group-hover:opacity-100"
                        } transition-opacity`}
                      >
                        {template.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-red-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Generate button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
                className="flex items-center gap-2 rounded-xl bg-accent-cyan px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
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
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate Game
                  </>
                )}
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                disabled={generating}
                className="rounded-xl px-4 py-2.5 text-sm text-muted transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function CreatePage() {
  return (
    <ProtectedRoute>
      <CreateContent />
    </ProtectedRoute>
  );
}
