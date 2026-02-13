"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EXAMPLE_GAMES = [
  {
    title: "Neon Platformer",
    description: "Jump across floating platforms, dodge spikes, and collect glowing orbs.",
    type: "Platformer",
    color: "#22d3ee",
  },
  {
    title: "Space Blaster",
    description: "Pilot a ship through asteroid fields and blast incoming enemies.",
    type: "Shooter",
    color: "#a855f7",
  },
  {
    title: "Dungeon Crawler",
    description: "Explore tile-based dungeons, fight slimes, and find the exit.",
    type: "Top-Down",
    color: "#3b82f6",
  },
  {
    title: "Gem Match",
    description: "Swap and match colorful gems in a grid to clear levels.",
    type: "Puzzle",
    color: "#f59e0b",
  },
];

function GameCard({
  title,
  description,
  type,
  color,
}: {
  title: string;
  description: string;
  type: string;
  color: string;
}) {
  return (
    <div className="game-card-hover group relative overflow-hidden rounded-xl border border-card-border bg-card p-4 transition-all hover:border-white/10 hover:bg-white/[0.03] sm:rounded-2xl sm:p-6">
      {/* Faux game preview */}
      <div
        className="mb-3 flex h-28 items-center justify-center rounded-lg sm:mb-4 sm:h-40 sm:rounded-xl"
        style={{ backgroundColor: `${color}08` }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-10 w-10 rounded-lg"
            style={{ backgroundColor: `${color}30`, border: `2px solid ${color}60` }}
          />
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  width: `${12 + Math.random() * 20}px`,
                  backgroundColor: `${color}${i % 2 === 0 ? "40" : "20"}`,
                }}
              />
            ))}
          </div>
          <div
            className="h-2 w-16 rounded-full"
            style={{ backgroundColor: `${color}15` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {type}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </main>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-12">
        <div className="font-display text-lg font-bold tracking-tight sm:text-xl">
          <span className="text-accent-cyan">Game</span>
          <span className="text-accent-purple">Forge</span>
        </div>
        <button
          onClick={() => signIn()}
          className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-white/[0.06] sm:px-4 sm:py-2"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-12 md:pt-20">
        <div className="flex flex-col items-center gap-5 text-center sm:gap-6">
          <div className="rounded-full border border-card-border bg-card px-3 py-1 text-[11px] font-medium text-muted sm:px-4 sm:py-1.5 sm:text-xs">
            Powered by Gemini + Phaser.js
          </div>
          <h1 className="font-display max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-6xl">
            Describe a game,{" "}
            <span className="bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
              play it in seconds
            </span>
          </h1>
          <p className="max-w-lg text-sm text-muted sm:text-base md:text-lg">
            GameForge turns your ideas into playable browser games using AI
            multi-agent orchestration. No code required.
          </p>

          {/* Auth buttons */}
          <div className="mt-2 flex w-full max-w-sm flex-col gap-3 sm:mt-4 sm:w-auto sm:flex-row">
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="flex items-center justify-center gap-2.5 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:px-6"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="flex items-center justify-center gap-2.5 rounded-xl border border-card-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06] sm:px-6"
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
          </div>
        </div>
      </section>

      {/* Example games */}
      <section className="border-t border-card-border px-4 py-10 sm:px-6 sm:py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display mb-2 text-center text-xs font-medium uppercase tracking-widest text-muted sm:text-sm">
            What you can build
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-4">
            {EXAMPLE_GAMES.map((game) => (
              <GameCard key={game.title} {...game} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border px-4 py-5 sm:px-6 sm:py-6 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div className="font-display text-xs text-muted">
            <span className="text-accent-cyan">Game</span>
            <span className="text-accent-purple">Forge</span>
            <span className="ml-2">by harikp.com</span>
          </div>
          <div className="text-xs text-muted">
            Built with Next.js, FastAPI &amp; Google ADK
          </div>
        </div>
      </footer>
    </main>
  );
}
