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
    | "progress";
  agent?: string;
  content?: string;
  filename?: string;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
  iteration?: number;
  game_code?: string;
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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail || body.message || message;
    } catch {
      // response body wasn't JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
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
        callbacks.onError?.(new ApiError(res.status, message));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
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

      callbacks.onComplete?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      callbacks.onError?.(err as Error);
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
        let message = `Iteration failed with status ${res.status}`;
        try {
          const body = await res.json();
          message = body.detail || body.message || message;
        } catch {
          // not JSON
        }
        callbacks.onError?.(new ApiError(res.status, message));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
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

      callbacks.onComplete?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      callbacks.onError?.(err as Error);
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

export async function getAuditResults(
  gameId: string,
): Promise<AuditResult[]> {
  return request<AuditResult[]>(`/api/games/${gameId}/audits`);
}
