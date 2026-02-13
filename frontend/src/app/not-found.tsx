import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* 404 graphic */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-6xl font-bold text-accent-cyan sm:text-8xl">4</span>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-card-border bg-card sm:h-20 sm:w-20">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-purple"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 12h4" />
              <path d="M8 10v4" />
              <circle cx="15" cy="11" r="1" />
              <circle cx="18" cy="13" r="1" />
            </svg>
          </div>
          <span className="font-mono text-6xl font-bold text-accent-cyan sm:text-8xl">4</span>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-muted">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-accent-cyan px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-card-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6">
        <p className="text-xs text-muted/60">GameForge</p>
      </div>
    </div>
  );
}
