"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GamePreviewProps {
  gameCode: string;
  onError?: (errors: string[]) => void;
}

interface LogEntry {
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
html,body{width:100%;height:100%;overflow:hidden;background:#0c0c0c}
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

export default function GamePreview({ gameCode, onError }: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const errorsRef = useRef<string[]>([]);

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
          setLogs((prev) => [
            ...prev.slice(-199),
            { type: "log", message: msg.data?.message || "", timestamp: now },
          ]);
          break;

        case "warn":
          setLogs((prev) => [
            ...prev.slice(-199),
            { type: "warn", message: msg.data?.message || "", timestamp: now },
          ]);
          break;

        case "error": {
          const errorMsg = msg.data?.message || "Unknown error";
          setErrors((prev) => {
            const next = [...prev, errorMsg];
            errorsRef.current = next;
            return next;
          });
          setLogs((prev) => [
            ...prev.slice(-199),
            { type: "error", message: errorMsg, timestamp: now },
          ]);
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

  // Restart: bump iframe key to force remount
  const handleRestart = useCallback(() => {
    setLoading(true);
    setErrors([]);
    setLogs([]);
    errorsRef.current = [];
    setIframeKey((k) => k + 1);
  }, []);

  // Open game in new tab
  const handleOpenNewTab = useCallback(() => {
    const html = BASE_TEMPLATE.replace("__GAME_CODE__", gameCode);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revoke after a short delay to allow the tab to load
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [gameCode]);

  const hasErrors = errors.length > 0;
  const errorCount = errors.length;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-card-border px-3 sm:h-12 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-foreground">Preview</h3>
          <span className="hidden rounded-md bg-card px-2 py-0.5 text-xs text-muted border border-card-border sm:inline-flex">
            Game
          </span>
          {hasErrors && (
            <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-400 border border-red-500/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Restart */}
          <button
            onClick={handleRestart}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            title="Restart game"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          {/* Toggle logs */}
          <button
            onClick={() => setLogsOpen((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              logsOpen
                ? "bg-accent-cyan/10 text-accent-cyan"
                : "text-muted hover:bg-card hover:text-foreground"
            }`}
            title="Toggle console logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          {/* Open in new tab */}
          <button
            onClick={handleOpenNewTab}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground"
            title="Open in new tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Game iframe area */}
      <div className="relative flex-1 bg-[#0a0a0a]">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan/20 border-t-accent-cyan" />
              <p className="text-xs text-muted">Loading game...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {hasErrors && !logsOpen && (
          <div className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-red-500/20 bg-[#1a0a0a]/95 p-3 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="mt-0.5 shrink-0 text-red-400"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-red-400">
                    Runtime Error
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-red-300/80">
                    {errors[errors.length - 1]}
                  </p>
                  {errorCount > 1 && (
                    <button
                      onClick={() => setLogsOpen(true)}
                      className="mt-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      +{errorCount - 1} more error{errorCount - 1 !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setErrors([])}
                className="shrink-0 text-red-400/40 hover:text-red-400 transition-colors"
                title="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
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
      </div>

      {/* Collapsible console log panel */}
      {logsOpen && (
        <div className="flex max-h-48 flex-col border-t border-card-border bg-[#0e0e0e]">
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
            <span className="font-mono text-xs text-muted">Console</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLogs([]);
                  setErrors([]);
                  errorsRef.current = [];
                }}
                className="font-mono text-xs text-muted hover:text-foreground transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setLogsOpen(false)}
                className="text-muted hover:text-foreground transition-colors"
                title="Close console"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {logs.length === 0 ? (
              <p className="py-2 font-mono text-xs text-muted/50">
                No console output yet
              </p>
            ) : (
              logs.map((entry, i) => (
                <div
                  key={i}
                  className={`border-b border-white/[0.03] py-1 font-mono text-xs leading-relaxed ${
                    entry.type === "error"
                      ? "text-red-400"
                      : entry.type === "warn"
                        ? "text-yellow-400"
                        : "text-muted"
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
