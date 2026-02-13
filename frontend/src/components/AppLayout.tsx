"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useCallback, type ReactNode } from "react";

interface AppLayoutProps {
  sidebar?: ReactNode;
  children: ReactNode;
}

type Breakpoint = "mobile" | "tablet" | "desktop";

function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 768) setBreakpoint("mobile");
      else if (w < 1024) setBreakpoint("tablet");
      else setBreakpoint("desktop");
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return breakpoint;
}

export default function AppLayout({ sidebar, children }: AppLayoutProps) {
  const { data: session } = useSession();
  const breakpoint = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Close sidebar when switching to mobile/tablet
  useEffect(() => {
    if (breakpoint !== "desktop") {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [breakpoint]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const sidebarContent = sidebar || <DefaultSidebar />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-card-border px-4">
        <div className="flex items-center gap-3">
          {/* Sidebar toggle (mobile + tablet) */}
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {sidebarOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          {/* Logo */}
          <a href="/dashboard" className="flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-accent-cyan">Game</span>
              <span className="text-accent-purple">Forge</span>
            </span>
          </a>
        </div>

        {/* User menu */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-muted">
                {session.user.name || session.user.email}
              </span>
            </div>
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                width={32}
                height={32}
                className="rounded-full border border-card-border"
                unoptimized
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-card-border text-sm font-medium text-muted">
                {(session.user.name || session.user.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-card hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar - desktop (persistent left panel) */}
        <aside
          className={`hidden lg:flex w-80 shrink-0 flex-col border-r border-card-border bg-background transition-all duration-200 ${
            sidebarOpen ? "lg:w-80" : "lg:w-0 lg:overflow-hidden lg:border-r-0"
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden">
            {sidebarContent}
          </div>
        </aside>

        {/* Sidebar - tablet (left overlay, same as before) */}
        {sidebarOpen && breakpoint === "tablet" && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={closeSidebar}
            />
            <aside className="fixed inset-y-14 left-0 z-50 flex w-80 flex-col border-r border-card-border bg-background">
              <div className="flex h-full flex-col overflow-hidden">
                {sidebarContent}
              </div>
            </aside>
          </>
        )}

        {/* Sidebar - mobile (bottom sheet) */}
        {sidebarOpen && breakpoint === "mobile" && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={closeSidebar}
            />
            <aside className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-card-border bg-background">
              {/* Bottom sheet drag handle */}
              <div className="flex shrink-0 items-center justify-center pb-1 pt-3">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto">
                {sidebarContent}
              </div>
            </aside>
          </>
        )}

        {/* Desktop sidebar toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex absolute left-0 top-1/2 z-30 -translate-y-1/2 h-16 w-4 items-center justify-center rounded-r-md bg-card border border-l-0 border-card-border text-muted transition-colors hover:text-foreground hover:bg-card"
          style={{ left: sidebarOpen ? "320px" : "0px" }}
          aria-label="Toggle sidebar"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {sidebarOpen ? (
              <polyline points="15 18 9 12 15 6" />
            ) : (
              <polyline points="9 18 15 12 9 6" />
            )}
          </svg>
        </button>

        {/* Center - game preview / main content (takes full width on mobile) */}
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function DefaultSidebar() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">No activity yet</p>
      </div>
    </div>
  );
}
