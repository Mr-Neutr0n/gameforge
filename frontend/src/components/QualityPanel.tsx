"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAuditResults,
  runAllAudits,
  type AuditResult,
} from "@/lib/api";

interface QualityPanelProps {
  gameId: string;
  /** If provided from SSE, use this data instead of fetching. */
  sseAuditData?: {
    overall_score: number;
    overall_passed: boolean;
    audits: Record<string, { passed: boolean; score: number }>;
  } | null;
}

const AUDIT_LABELS: Record<string, string> = {
  logic: "Logic",
  ui: "UI",
  code: "Code Quality",
};

const AUDIT_DESCRIPTIONS: Record<string, string> = {
  logic: "Game structure, scenes, input handling",
  ui: "Dimensions, background, fonts, layout",
  code: "Security, best practices, cleanup",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-400/10 border-green-400/20";
  if (score >= 50) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function statusDot(passed: boolean): string {
  return passed ? "bg-green-400" : "bg-red-400";
}

interface CheckDetail {
  check: string;
  passed: boolean;
  message: string;
}

export default function QualityPanel({
  gameId,
  sseAuditData,
}: QualityPanelProps) {
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  // Load existing audit results on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const results = await getAuditResults(gameId);
        if (!cancelled && results.length > 0) {
          setAuditResults(results);
          const scores = results.map((r) => r.score);
          setOverallScore(
            Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          );
        }
      } catch {
        // No audit results yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // Update from SSE audit data if provided
  useEffect(() => {
    if (!sseAuditData) return;
    setOverallScore(sseAuditData.overall_score);
    // Convert SSE data to a lightweight version for display
    const synthetic: AuditResult[] = Object.entries(sseAuditData.audits).map(
      ([type, data]) => ({
        id: "",
        game_id: gameId,
        audit_type: type as AuditResult["audit_type"],
        passed: data.passed,
        score: data.score,
        details: null,
        created_at: new Date().toISOString(),
      }),
    );
    setAuditResults(synthetic);
    // Refetch full results to get details
    getAuditResults(gameId)
      .then((results) => {
        if (results.length > 0) {
          setAuditResults(results);
        }
      })
      .catch(() => {});
  }, [sseAuditData, gameId]);

  const handleRunAll = useCallback(async () => {
    setIsRunning(true);
    try {
      const summary = await runAllAudits(gameId);
      setOverallScore(summary.overall_score);
      // Refetch full results
      const results = await getAuditResults(gameId);
      setAuditResults(results);
    } catch {
      // Audit run failed
    } finally {
      setIsRunning(false);
    }
  }, [gameId]);

  const toggleExpand = useCallback((auditType: string) => {
    setExpandedAudit((prev) => (prev === auditType ? null : auditType));
  }, []);

  const hasResults = auditResults.length > 0;

  return (
    <div className="border-b border-card-border bg-background">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-accent-cyan"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold text-foreground">
              Quality
            </span>

            {/* Overall score badge */}
            {overallScore !== null && (
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-xs font-medium ${scoreBgColor(overallScore)} ${scoreColor(overallScore)}`}
              >
                {overallScore}/100
              </span>
            )}
          </div>

          {/* Re-run button */}
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-foreground" />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
            {isRunning ? "Running..." : "Re-run"}
          </button>
        </div>

        {/* Loading state */}
        {loading && !hasResults && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-foreground" />
            Loading audit results...
          </div>
        )}

        {/* No results state */}
        {!loading && !hasResults && !isRunning && (
          <p className="mt-2 text-xs text-muted">
            No audit results yet. Generate a game to see quality scores.
          </p>
        )}

        {/* Audit results grid */}
        {hasResults && (
          <div className="mt-2.5 space-y-1.5">
            {auditResults.map((result) => {
              const auditType =
                typeof result.audit_type === "string"
                  ? result.audit_type
                  : result.audit_type;
              const isExpanded = expandedAudit === auditType;
              const checks =
                result.details &&
                "checks" in result.details
                  ? (result.details.checks as CheckDetail[])
                  : null;

              return (
                <div key={auditType}>
                  <button
                    onClick={() => checks && toggleExpand(auditType)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isExpanded
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.02]"
                    } ${checks ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot(result.passed)}`}
                      />
                      <div>
                        <span className="text-xs font-medium text-foreground">
                          {AUDIT_LABELS[auditType] || auditType}
                        </span>
                        <span className="ml-2 text-[10px] text-muted">
                          {AUDIT_DESCRIPTIONS[auditType] || ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-medium ${scoreColor(result.score)}`}
                      >
                        {result.score}
                      </span>
                      {checks && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Expanded check details */}
                  {isExpanded && checks && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-card-border pl-3 pb-1">
                      {checks.map((check, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-0.5"
                        >
                          {check.passed ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0 text-green-400"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0 text-red-400"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                          <span className="text-[11px] leading-relaxed text-muted">
                            {check.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
