"use client";

import { useEffect, useRef, useState } from "react";
import type { SSEEvent } from "@/lib/api";

// --- Types ---

interface ActivityItem {
  id: string;
  type: SSEEvent["type"];
  agent?: string;
  summary: string;
  detail?: string;
  timestamp: number;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
  iteration?: number;
}

interface ActivityFeedProps {
  events: SSEEvent[];
  isGenerating: boolean;
  startTime?: number;
}

// --- Helpers ---

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function agentDisplayName(agent?: string): string {
  const names: Record<string, string> = {
    planner: "Planner",
    code_generator: "Generator",
    validator: "Validator",
    fixer: "Fixer",
    iterator: "Iterator",
    coordinator: "Coordinator",
  };
  return agent ? names[agent] || agent : "Agent";
}

function eventToItem(event: SSEEvent, index: number): ActivityItem {
  const id = `evt-${index}-${Date.now()}`;
  const timestamp = Date.now();

  switch (event.type) {
    case "thinking":
      return {
        id,
        type: "thinking",
        agent: event.agent,
        summary: `${agentDisplayName(event.agent)} is thinking...`,
        detail: event.content,
        timestamp,
      };
    case "progress":
      return {
        id,
        type: "progress",
        agent: event.agent,
        summary: event.content || "Working...",
        timestamp,
      };
    case "code":
      return {
        id,
        type: "code",
        agent: event.agent,
        summary: `Code generated: ${event.filename || "game.js"}`,
        detail: event.content
          ? event.content.length > 500
            ? event.content.slice(0, 500) + "\n..."
            : event.content
          : undefined,
        timestamp,
      };
    case "validation":
      return {
        id,
        type: "validation",
        agent: event.agent,
        summary: event.valid
          ? "Validation passed"
          : `Validation failed (${event.errors?.length || 0} errors)`,
        valid: event.valid,
        errors: event.errors,
        warnings: event.warnings,
        timestamp,
      };
    case "fix":
      return {
        id,
        type: "fix",
        agent: event.agent,
        summary: `Fix iteration ${event.iteration || "?"}`,
        iteration: event.iteration,
        timestamp,
      };
    case "complete":
      return {
        id,
        type: "complete",
        agent: event.agent,
        summary: "Generation complete",
        timestamp,
      };
    case "error":
      return {
        id,
        type: "error",
        agent: event.agent,
        summary: event.content || "An error occurred",
        timestamp,
      };
    default:
      return {
        id,
        type: event.type,
        agent: event.agent,
        summary: event.content || "Event",
        timestamp,
      };
  }
}

// --- Color config per event type ---

interface EventStyle {
  dotColor: string;
  lineColor: string;
  label: string;
  labelBg: string;
  labelText: string;
}

function getEventStyle(type: SSEEvent["type"], valid?: boolean): EventStyle {
  switch (type) {
    case "thinking":
      return {
        dotColor: "bg-blue-400",
        lineColor: "border-blue-400/30",
        label: "Plan",
        labelBg: "bg-blue-400/10",
        labelText: "text-blue-400",
      };
    case "progress":
      return {
        dotColor: "bg-blue-400",
        lineColor: "border-blue-400/30",
        label: "Progress",
        labelBg: "bg-blue-400/10",
        labelText: "text-blue-400",
      };
    case "code":
      return {
        dotColor: "bg-emerald-400",
        lineColor: "border-emerald-400/30",
        label: "Code",
        labelBg: "bg-emerald-400/10",
        labelText: "text-emerald-400",
      };
    case "validation":
      if (valid) {
        return {
          dotColor: "bg-emerald-400",
          lineColor: "border-emerald-400/30",
          label: "Valid",
          labelBg: "bg-emerald-400/10",
          labelText: "text-emerald-400",
        };
      }
      return {
        dotColor: "bg-amber-400",
        lineColor: "border-amber-400/30",
        label: "Invalid",
        labelBg: "bg-amber-400/10",
        labelText: "text-amber-400",
      };
    case "fix":
      return {
        dotColor: "bg-orange-400",
        lineColor: "border-orange-400/30",
        label: "Fix",
        labelBg: "bg-orange-400/10",
        labelText: "text-orange-400",
      };
    case "complete":
      return {
        dotColor: "bg-emerald-400",
        lineColor: "border-emerald-400/30",
        label: "Done",
        labelBg: "bg-emerald-400/10",
        labelText: "text-emerald-400",
      };
    case "error":
      return {
        dotColor: "bg-red-400",
        lineColor: "border-red-400/30",
        label: "Error",
        labelBg: "bg-red-400/10",
        labelText: "text-red-400",
      };
    default:
      return {
        dotColor: "bg-text-tertiary",
        lineColor: "border-text-tertiary/30",
        label: "Event",
        labelBg: "bg-text-tertiary/10",
        labelText: "text-text-tertiary",
      };
  }
}

// --- Components ---

function ExpandableContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150 ease-in-out"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-0 border border-border-default p-2 font-mono text-xs text-text-tertiary leading-relaxed max-h-48 overflow-y-auto">
          {content}
        </pre>
      )}
    </div>
  );
}

function ValidationDetails({
  errors,
  warnings,
}: {
  errors?: string[];
  warnings?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = (errors && errors.length > 0) || (warnings && warnings.length > 0);

  if (!hasDetails) return null;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150 ease-in-out"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {errors?.map((err, i) => (
            <div
              key={`err-${i}`}
              className="flex items-start gap-1.5 text-xs"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <span className="text-red-400/80">{err}</span>
            </div>
          ))}
          {warnings?.map((warn, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-start gap-1.5 text-xs"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="text-amber-400/80">{warn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBorderColor(type: SSEEvent["type"], valid?: boolean): string {
  switch (type) {
    case "thinking":
    case "progress":
      return "border-l-blue-500";
    case "code":
      return "border-l-emerald-500";
    case "validation":
      return valid ? "border-l-green-500" : "border-l-red-500";
    case "fix":
      return "border-l-orange-500";
    case "complete":
      return "border-l-cyan-500";
    case "error":
      return "border-l-red-500";
    default:
      return "border-l-white/20";
  }
}

function TimelineItem({ item }: { item: ActivityItem }) {
  const style = getEventStyle(item.type, item.valid);
  const borderColor = getBorderColor(item.type, item.valid);

  return (
    <div className={`relative flex gap-3 pb-4 last:pb-0 border-l-2 ${borderColor} pl-1`}>
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dotColor} ring-2 ring-surface-0`}
        />
        <div className={`w-px flex-1 border-l ${style.lineColor}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${style.labelBg} ${style.labelText}`}
          >
            {style.label}
          </span>
          {item.agent && (
            <span className="text-[10px] text-text-tertiary font-mono">
              {agentDisplayName(item.agent)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-primary/80 leading-relaxed">
          {item.summary}
        </p>

        {/* Expandable content */}
        {item.detail && <ExpandableContent content={item.detail} />}

        {/* Validation errors/warnings */}
        {item.type === "validation" && (
          <ValidationDetails
            errors={item.errors}
            warnings={item.warnings}
          />
        )}

        {/* Completion checkmark */}
        {item.type === "complete" && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-xs text-emerald-400">
              Game ready to play
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <div className="relative flex gap-3 pb-0">
      <div className="flex flex-col items-center">
        <div className="relative h-2.5 w-2.5">
          <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" />
          <div className="relative h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface-0" />
        </div>
      </div>
      <div className="-mt-0.5">
        <span className="text-xs text-text-tertiary animate-pulse">
          Working...
        </span>
      </div>
    </div>
  );
}

// --- Main component ---

export default function ActivityFeed({
  events,
  isGenerating,
  startTime,
}: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Convert SSE events to activity items
  const items = events.map((event, i) => eventToItem(event, i));

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length]);

  // Elapsed time ticker
  useEffect(() => {
    if (!isGenerating || !startTime) {
      return;
    }
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating, startTime]);

  if (items.length === 0 && !isGenerating) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1 border border-border-default">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-tertiary"
            >
              <path
                d="M12 8v4l3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <p className="text-sm text-text-tertiary">
            Activity will appear here
            <br />
            once generation starts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Timer bar */}
      {(isGenerating || items.length > 0) && (
        <div className="flex items-center justify-between border-b border-border-default px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            {isGenerating && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
            )}
            <span className="text-xs text-text-tertiary">
              {isGenerating ? "Generating" : "Complete"}
            </span>
          </div>
          {startTime && (
            <span className="font-mono text-xs text-text-tertiary tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4"
      >
        {items.map((item) => (
          <TimelineItem key={item.id} item={item} />
        ))}
        {isGenerating && <PulsingDot />}
      </div>
    </div>
  );
}
