import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types ---

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  prompt: string | null;
  game_code: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  game_id: string;
  role: "user" | "agent";
  content: string;
  step_type: "plan" | "code" | "validate" | "fix" | "user";
  created_at: string;
}

export interface AuditResult {
  id: string;
  game_id: string;
  audit_type: "logic" | "ui" | "code" | "security";
  passed: boolean;
  score: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface GameWithConversation extends Game {
  conversations: Conversation[];
  audit_results?: AuditResult[];
}

export interface PublicGame {
  id: string;
  title: string | null;
  description: string | null;
  game_code: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  creator_name: string | null;
}

export interface CreateGameRequest {
  prompt: string;
  template_type?: "platformer" | "topdown" | "shooter" | "puzzle" | "custom";
}

export interface UpdateGameRequest {
  title?: string;
  description?: string;
  is_public?: boolean;
  game_code?: string;
}

export interface SSEEvent {
  type:
    | "thinking"
    | "code"
    | "validation"
    | "fix"
    | "complete"
    | "error"
    | "progress"
    | "audit";
  agent?: string;
  content?: string;
  filename?: string;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
  iteration?: number;
  game_code?: string;
  overall_score?: number;
  overall_passed?: boolean;
  audits?: Record<string, { passed: boolean; score: number }>;
}

export interface AuditSummary {
  overall_score: number;
  overall_passed: boolean;
  audits: Record<string, { passed: boolean; score: number; audit_id: string }>;
}

export interface PublicAuditSummary {
  overall_score: number;
  has_audits: boolean;
  audits: Record<string, { passed: boolean; score: number }>;
}

// --- Error handling ---

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Map HTTP status codes to user-friendly error messages.
 */
function friendlyErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage;

  switch (status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Session expired. Please sign in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "The requested resource was not found.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Server error. Please try again later.";
    case 502:
    case 503:
    case 504:
      return "Service temporarily unavailable. Please try again.";
    default:
      return `Request failed (${status})`;
  }
}

/**
 * Check if a failed request should be retried.
 * Only retry on network errors and 5xx server errors, not on 4xx client errors.
 */
function isRetryable(error: unknown): boolean {
  // Network errors (fetch throws TypeError on network failures)
  if (error instanceof TypeError) return true;
  // Retry on 5xx and 429 (rate limited)
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429;
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.backendToken) {
    headers["Authorization"] = `Bearer ${session.backendToken}`;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = await getAuthHeaders();

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
      });

      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const body = await res.json();
          serverMessage = body.detail || body.message;
        } catch {
          // response body wasn't JSON
        }
        throw new ApiError(
          res.status,
          friendlyErrorMessage(res.status, serverMessage),
        );
      }

      if (res.status === 204) {
        return undefined as T;
      }

      return res.json();
    } catch (err) {
      lastError = err;

      // Don't retry non-retryable errors or if this was the last attempt
      if (!isRetryable(err) || attempt === MAX_RETRIES) {
        break;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  // Re-throw the last error
  if (lastError instanceof ApiError) {
    throw lastError;
  }
  if (lastError instanceof TypeError) {
    throw new ApiError(0, "Network error. Check your connection and try again.");
  }
  throw lastError;
}

// --- Auth ---

export async function getCurrentUser(): Promise<User> {
  return request<User>("/api/auth/me");
}

// --- Games CRUD ---

export async function getMyGames(): Promise<Game[]> {
  return request<Game[]>("/api/games");
}

export async function getGame(id: string): Promise<GameWithConversation> {
  return request<GameWithConversation>(`/api/games/${id}`);
}

export async function getPublicGame(id: string): Promise<PublicGame> {
  return request<PublicGame>(`/api/games/${id}/public`);
}

export async function createGame(data: CreateGameRequest): Promise<Game> {
  return request<Game>("/api/games", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGame(
  id: string,
  data: UpdateGameRequest,
): Promise<Game> {
  return request<Game>(`/api/games/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGame(id: string): Promise<void> {
  return request<void>(`/api/games/${id}`, {
    method: "DELETE",
  });
}

// --- SSE timeout constants ---

const GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ITERATE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Classify an SSE streaming error into a user-friendly message.
 */
function classifyStreamError(err: unknown, timeoutId: ReturnType<typeof setTimeout> | null): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Connection lost. Check your network and try again.";
  if (err instanceof Error && err.name === "AbortError") {
    // If the timeout already fired and cleared timeoutId, this was a timeout abort
    return timeoutId === null
      ? "Generation timed out. Please try again."
      : "Request was cancelled.";
  }
  return "An unexpected error occurred. Please try again.";
}

// --- Generation (SSE streaming) ---

export function streamGameGeneration(
  gameId: string,
  data: { prompt: string; template_type?: string },
  callbacks: {
    onEvent: (event: SSEEvent) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  },
): AbortController {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Set up automatic timeout
  timeoutId = setTimeout(() => {
    timeoutId = null; // Mark that the timeout fired
    controller.abort();
    callbacks.onError?.(new Error("Generation timed out. Please try again."));
  }, GENERATE_TIMEOUT_MS);

  (async () => {
    try {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_URL}/api/games/${gameId}/generate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(data),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        let message = `Generation failed with status ${res.status}`;
        try {
          const body = await res.json();
          message = body.detail || body.message || message;
        } catch {
          // not JSON
        }
        if (timeoutId) clearTimeout(timeoutId);
        callbacks.onError?.(new ApiError(res.status, message));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        if (timeoutId) clearTimeout(timeoutId);
        callbacks.onError?.(new Error("No response body"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") {
            if (timeoutId) clearTimeout(timeoutId);
            callbacks.onComplete?.();
            return;
          }

          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            callbacks.onEvent(event);
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
      callbacks.onComplete?.();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      // If timeout already fired and called onError, don't double-report
      if ((err as Error).name === "AbortError" && timeoutId === null) return;
      // User-initiated abort (e.g. component unmount)
      if ((err as Error).name === "AbortError") return;
      const message = classifyStreamError(err, timeoutId);
      callbacks.onError?.(new Error(message));
    }
  })();

  return controller;
}

// --- Iteration (SSE streaming) ---

export function streamGameIteration(
  gameId: string,
  message: string,
  callbacks: {
    onEvent: (event: SSEEvent) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  },
): AbortController {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Set up automatic timeout
  timeoutId = setTimeout(() => {
    timeoutId = null; // Mark that the timeout fired
    controller.abort();
    callbacks.onError?.(new Error("Generation timed out. Please try again."));
  }, ITERATE_TIMEOUT_MS);

  (async () => {
    try {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_URL}/api/games/${gameId}/iterate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ message }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        let errMessage = `Iteration failed with status ${res.status}`;
        try {
          const body = await res.json();
          errMessage = body.detail || body.message || errMessage;
        } catch {
          // not JSON
        }
        if (timeoutId) clearTimeout(timeoutId);
        callbacks.onError?.(new ApiError(res.status, errMessage));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        if (timeoutId) clearTimeout(timeoutId);
        callbacks.onError?.(new Error("No response body"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") {
            if (timeoutId) clearTimeout(timeoutId);
            callbacks.onComplete?.();
            return;
          }

          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            callbacks.onEvent(event);
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
      callbacks.onComplete?.();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      // If timeout already fired and called onError, don't double-report
      if ((err as Error).name === "AbortError" && timeoutId === null) return;
      // User-initiated abort (e.g. component unmount)
      if ((err as Error).name === "AbortError") return;
      const errMessage = classifyStreamError(err, timeoutId);
      callbacks.onError?.(new Error(errMessage));
    }
  })();

  return controller;
}

// --- Conversation ---

export async function getConversation(
  gameId: string,
): Promise<Conversation[]> {
  return request<Conversation[]>(`/api/games/${gameId}/conversations`);
}

// --- Audits ---

export async function runAudit(
  gameId: string,
  auditType: "logic" | "ui" | "code",
): Promise<AuditResult> {
  return request<AuditResult>(`/api/games/${gameId}/audit/${auditType}`, {
    method: "POST",
  });
}

export async function runAllAudits(
  gameId: string,
): Promise<AuditSummary> {
  return request<AuditSummary>(`/api/games/${gameId}/audit/all`, {
    method: "POST",
  });
}

export async function getAuditResults(
  gameId: string,
): Promise<AuditResult[]> {
  return request<AuditResult[]>(`/api/games/${gameId}/audits`);
}

export async function getPublicAuditSummary(
  gameId: string,
): Promise<PublicAuditSummary> {
  const res = await fetch(
    `${API_URL}/api/games/${gameId}/audits/public`,
  );
  if (!res.ok) {
    return { overall_score: 0, has_audits: false, audits: {} };
  }
  return res.json();
}
