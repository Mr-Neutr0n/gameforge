"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GamePreviewProps {
  gameCode: string;
  onError?: (errors: string[]) => void;
  onLog?: (logs: LogEntry[]) => void;
}

export interface LogEntry {
  type: "log" | "warn" | "error";
  message: string;
  timestamp: number;
}

const BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GameForge Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#09090b}
#game-container{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
#game-container canvas{display:block;max-width:100%;max-height:100%}
</style>
</head>
<body>
<div id="game-container"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"><\/script>
<script>
(function(){
var origin='*';
function postToParent(type,data){
try{if(window.parent&&window.parent!==window){window.parent.postMessage({source:'gameforge-preview',type:type,data:data},origin)}}catch(e){}
}
var origLog=console.log;
console.log=function(){var a=Array.prototype.slice.call(arguments);var m=a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');postToParent('log',{message:m});origLog.apply(console,arguments)};
var origWarn=console.warn;
console.warn=function(){var a=Array.prototype.slice.call(arguments);var m=a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');postToParent('warn',{message:m});origWarn.apply(console,arguments)};
var origErr=console.error;
console.error=function(){var a=Array.prototype.slice.call(arguments);var m=a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');postToParent('error',{message:m});origErr.apply(console,arguments)};
window.onerror=function(message,source,lineno,colno,error){var d=message;if(lineno)d+=' (line '+lineno+')';if(error&&error.stack)d+='\\n'+error.stack;postToParent('error',{message:d});return false};
window.addEventListener('unhandledrejection',function(event){var m='Unhandled Promise Rejection: ';if(event.reason){m+=event.reason.message||String(event.reason);if(event.reason.stack)m+='\\n'+event.reason.stack}postToParent('error',{message:m})});
postToParent('ready',{timestamp:Date.now()});
})();
<\/script>
<script>
window.addEventListener('resize',function(){if(typeof game!=='undefined'&&game&&game.scale){game.scale.resize(window.innerWidth,window.innerHeight)}});
<\/script>
<script>
__GAME_CODE__
<\/script>
</body>
</html>`;

export default function GamePreview({
  gameCode,
  onError,
  onLog,
}: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const errorsRef = useRef<string[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Build the full HTML for the iframe
  const buildSrc = useCallback((code: string): string => {
    const html = BASE_TEMPLATE.replace("__GAME_CODE__", code);
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }, []);

  // Listen for postMessage events from the iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data;
      if (!msg || msg.source !== "gameforge-preview") return;

      const now = Date.now();

      switch (msg.type) {
        case "ready":
          setLoading(false);
          break;

        case "log":
          setLogs((prev) => {
            const next = [
              ...prev.slice(-199),
              {
                type: "log" as const,
                message: msg.data?.message || "",
                timestamp: now,
              },
            ];
            logsRef.current = next;
            return next;
          });
          break;

        case "warn":
          setLogs((prev) => {
            const next = [
              ...prev.slice(-199),
              {
                type: "warn" as const,
                message: msg.data?.message || "",
                timestamp: now,
              },
            ];
            logsRef.current = next;
            return next;
          });
          break;

        case "error": {
          const errorMsg = msg.data?.message || "Unknown error";
          setErrors((prev) => {
            const next = [...prev, errorMsg];
            errorsRef.current = next;
            return next;
          });
          setLogs((prev) => {
            const next = [
              ...prev.slice(-199),
              { type: "error" as const, message: errorMsg, timestamp: now },
            ];
            logsRef.current = next;
            return next;
          });
          // Auto-expand error panel when errors arrive
          setErrorsOpen(true);
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Propagate errors to parent callback
  useEffect(() => {
    if (errors.length > 0) {
      onError?.(errors);
    }
  }, [errors, onError]);

  // Propagate logs to parent callback
  useEffect(() => {
    if (logs.length > 0) {
      onLog?.(logs);
    }
  }, [logs, onLog]);

  // Restart: bump iframe key to force remount
  const handleRestart = useCallback(() => {
    setLoading(true);
    setErrors([]);
    setLogs([]);
    errorsRef.current = [];
    logsRef.current = [];
    setErrorsOpen(false);
    setIframeKey((k) => k + 1);
  }, []);

  // Open game in new tab
  const handleOpenNewTab = useCallback(() => {
    const html = BASE_TEMPLATE.replace("__GAME_CODE__", gameCode);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [gameCode]);

  const hasErrors = errors.length > 0;
  const errorCount = errors.length;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-3 sm:h-12 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="font-mono text-sm font-medium text-text-primary tracking-wide">GAME</h3>
          <span className="hidden items-center gap-1.5 rounded-full bg-surface-1 px-2 py-0.5 text-[10px] font-medium text-text-tertiary border border-border-default sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Running
          </span>
          {hasErrors && (
            <button
              onClick={() => setErrorsOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20 transition-colors duration-150 ease-in-out hover:bg-red-500/20"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="tabular-nums">{errorCount}</span> error{errorCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Restart */}
          <button
            onClick={handleRestart}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 ease-in-out hover:bg-surface-1 hover:text-text-primary"
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
          {/* Toggle console */}
          <button
            onClick={() => setConsoleOpen((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ease-in-out ${
              consoleOpen
                ? "bg-accent-muted text-accent"
                : "text-text-tertiary hover:bg-surface-1 hover:text-text-primary"
            }`}
            title="Toggle console logs"
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
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          {/* Open in new tab */}
          <button
            onClick={handleOpenNewTab}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 ease-in-out hover:bg-surface-1 hover:text-text-primary"
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

      {/* Game iframe area with bezel frame */}
      <div className="relative flex-1 bg-surface-0 p-2 sm:p-3">
        <div
          className="relative h-full w-full overflow-hidden rounded-xl border border-border-hover"
          style={{ boxShadow: "0 0 40px rgba(6, 182, 212, 0.08)" }}
        >
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-0">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
                <p className="text-xs text-text-tertiary">Loading game...</p>
              </div>
            </div>
          )}

          {/* Sandboxed iframe */}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={buildSrc(gameCode)}
            sandbox="allow-scripts"
            className="h-full w-full border-0"
            title="Game Preview"
          />

          {/* Scanline overlay */}
          <div className="crt-scanlines absolute inset-0 z-[5]" />
        </div>
      </div>

      {/* Collapsible error panel below the game preview */}
      {hasErrors && (
        <div className="shrink-0 border-t border-red-500/20 bg-[#1a0a0a]">
          {/* Error panel header -- always visible when errors exist */}
          <button
            onClick={() => setErrorsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 transition-colors duration-150 ease-in-out hover:bg-red-500/5"
          >
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-red-400"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs font-medium text-red-400">
                <span className="tabular-nums">{errorCount}</span> Runtime Error{errorCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setErrors([]);
                  errorsRef.current = [];
                  setErrorsOpen(false);
                }}
                className="font-mono text-xs text-red-400/50 hover:text-red-400 transition-colors duration-150 ease-in-out"
              >
                Clear
              </button>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-red-400/50 transition-transform ${errorsOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {/* Expanded error list */}
          {errorsOpen && (
            <div className="max-h-40 overflow-y-auto border-t border-red-500/10 px-3 pb-2">
              {errors.map((error, i) => (
                <div
                  key={i}
                  className="border-b border-red-500/5 py-1.5 last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-red-500/50 tabular-nums">
                      {i + 1}.
                    </span>
                    <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-red-300/80">
                      {error}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible console log panel */}
      {consoleOpen && (
        <div className="flex max-h-48 flex-col border-t border-border-default bg-surface-0">
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
            <span className="font-mono text-xs text-text-tertiary">Console</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLogs([]);
                  logsRef.current = [];
                }}
                className="font-mono text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150 ease-in-out"
              >
                Clear
              </button>
              <button
                onClick={() => setConsoleOpen(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors duration-150 ease-in-out"
                title="Close console"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {logs.length === 0 ? (
              <p className="py-2 font-mono text-xs text-text-quaternary">
                No console output yet
              </p>
            ) : (
              logs.map((entry, i) => (
                <div
                  key={i}
                  className={`border-b border-border-default py-1 font-mono text-xs leading-relaxed ${
                    entry.type === "error"
                      ? "text-red-400"
                      : entry.type === "warn"
                        ? "text-yellow-400"
                        : "text-text-tertiary"
                  }`}
                >
                  <span className="mr-2 inline-block w-3 shrink-0 text-center opacity-50">
                    {entry.type === "error"
                      ? "x"
                      : entry.type === "warn"
                        ? "!"
                        : ">"}
                  </span>
                  <span className="break-all">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
