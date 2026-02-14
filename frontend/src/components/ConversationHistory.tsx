"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/api";

// --- Helpers ---

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface StepStyle {
  dotColor: string;
  lineColor: string;
  label: string;
  labelBg: string;
  labelText: string;
  icon: "user" | "plan" | "code" | "validate" | "fix";
}

function getStepStyle(
  role: string,
  stepType: string,
): StepStyle {
  if (role === "user") {
    return {
      dotColor: "bg-accent",
      lineColor: "border-accent/30",
      label: "You",
      labelBg: "bg-accent/10",
      labelText: "text-accent",
      icon: "user",
    };
  }

  switch (stepType) {
    case "plan":
      return {
        dotColor: "bg-blue-400",
        lineColor: "border-blue-400/30",
        label: "Plan",
        labelBg: "bg-blue-400/10",
        labelText: "text-blue-400",
        icon: "plan",
      };
    case "code":
      return {
        dotColor: "bg-emerald-400",
        lineColor: "border-emerald-400/30",
        label: "Code",
        labelBg: "bg-emerald-400/10",
        labelText: "text-emerald-400",
        icon: "code",
      };
    case "validate":
      return {
        dotColor: "bg-amber-400",
        lineColor: "border-amber-400/30",
        label: "Validate",
        labelBg: "bg-amber-400/10",
        labelText: "text-amber-400",
        icon: "validate",
      };
    case "fix":
      return {
        dotColor: "bg-orange-400",
        lineColor: "border-orange-400/30",
        label: "Fix",
        labelBg: "bg-orange-400/10",
        labelText: "text-orange-400",
        icon: "fix",
      };
    default:
      return {
        dotColor: "bg-text-tertiary",
        lineColor: "border-text-tertiary/30",
        label: "Agent",
        labelBg: "bg-text-tertiary/10",
        labelText: "text-text-tertiary",
        icon: "plan",
      };
  }
}

function truncateContent(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

function isCodeContent(stepType: string): boolean {
  return stepType === "code";
}

function isJsonContent(stepType: string): boolean {
  return stepType === "plan" || stepType === "validate";
}

// --- Sub-components ---

function ExpandableCode({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150 ease-in-out"
      >
        {expanded ? "Hide code" : "Show code"}
      </button>
      {expanded && (
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-0 border border-border-default p-2 font-mono text-xs text-text-tertiary leading-relaxed max-h-48 overflow-y-auto">
          {content.length > 2000 ? content.slice(0, 2000) + "\n..." : content}
        </pre>
      )}
    </div>
  );
}

function ExpandableJson({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  let formatted = content;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // not JSON, show raw
  }

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
          {formatted.length > 2000
            ? formatted.slice(0, 2000) + "\n..."
            : formatted}
        </pre>
      )}
    </div>
  );
}

function ConversationEntry({ entry }: { entry: Conversation }) {
  const style = getStepStyle(entry.role, entry.step_type);

  const summary =
    entry.role === "user"
      ? entry.content
      : isCodeContent(entry.step_type)
        ? `Generated code (${Math.round(entry.content.length / 1024)}KB)`
        : isJsonContent(entry.step_type)
          ? truncateContent(entry.content, 150)
          : truncateContent(entry.content, 200);

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
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
          <span className="text-[10px] text-text-quaternary">
            {formatTimestamp(entry.created_at)}
          </span>
        </div>

        {entry.role === "user" ? (
          <p className="mt-1 text-xs text-text-primary/90 leading-relaxed">
            {entry.content}
          </p>
        ) : isCodeContent(entry.step_type) ? (
          <>
            <p className="mt-1 text-xs text-text-primary/80 leading-relaxed">
              {summary}
            </p>
            <ExpandableCode content={entry.content} />
          </>
        ) : isJsonContent(entry.step_type) ? (
          <>
            <p className="mt-1 text-xs text-text-primary/80 leading-relaxed line-clamp-2">
              {summary}
            </p>
            <ExpandableJson content={entry.content} />
          </>
        ) : (
          <p className="mt-1 text-xs text-text-primary/80 leading-relaxed line-clamp-3">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Main component ---

interface ConversationHistoryProps {
  conversations: Conversation[];
}

export default function ConversationHistory({
  conversations,
}: ConversationHistoryProps) {
  if (conversations.length === 0) return null;

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-quaternary">
          History
        </span>
        <div className="h-px flex-1 bg-border-default" />
      </div>
      {conversations.map((entry) => (
        <ConversationEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
