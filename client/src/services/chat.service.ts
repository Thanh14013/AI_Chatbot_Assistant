import axiosInstance from "./axios.service";
import type {
  Conversation as ConversationType,
  ConversationListItem,
  Message,
} from "../types/chat.type";

/** Create a new conversation via API */
export type CreateConversationPayload = {
  title: string;
  model?: string;
  context_window?: number;
};

export const createConversation = async (
  payload: CreateConversationPayload
): Promise<ConversationType> => {
  const resp = await axiosInstance.post("/conversations", payload);
  return resp.data.data as ConversationType;
};

/** Get list of conversations with pagination and search */
export type GetConversationsParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type GetConversationsResult = {
  conversations: ConversationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const getConversations = async (
  params: GetConversationsParams = {}
): Promise<GetConversationsResult> => {
  const { page = 1, limit = 20, search } = params;

  // Build query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  const resp = await axiosInstance.get(
    `/conversations?${queryParams.toString()}`
  );

  return {
    conversations: resp.data.data as ConversationListItem[],
    pagination: resp.data.pagination,
  };
};

/** Get full conversation by id */
export const getConversation = async (
  id: string
): Promise<ConversationType> => {
  const resp = await axiosInstance.get(`/conversations/${id}`);
  return resp.data.data as ConversationType;
};

/** Get messages for a conversation */
export type GetMessagesResult = {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const getMessages = async (
  conversationId: string,
  page = 1,
  limit = 30
): Promise<GetMessagesResult> => {
  const resp = await axiosInstance.get(
    `/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
  );
  return {
    messages: resp.data.data as Message[],
    pagination: resp.data.pagination as GetMessagesResult["pagination"],
  };
};

/** Send a message in a conversation and receive AI response */
export type SendMessageResponse = {
  userMessage: Message;
  assistantMessage: Message;
  conversation?: {
    id: string;
    total_tokens_used: number;
    message_count: number;
  };
};

/**
 * Streamed send: POST to server streaming endpoint and receive incremental chunks.
 * Returns an object with an abort() method to cancel.
 */
export const sendMessageStream = async (
  conversationId: string,
  content: string,
  onChunk: (text: string) => void,
  onDone: (assistantMessage: Message | Record<string, unknown>) => void,
  onError?: (err: unknown) => void
): Promise<{ abort: () => void }> => {
  const controller = new AbortController();

  try {
    const base = axiosInstance.defaults.baseURL || "";
    const url = `${base.replace(
      /\/$/,
      ""
    )}/conversations/${conversationId}/messages/stream`;

    // Get access token from storage
    const { getAccessToken } = await import("../utils/token.util");
    const token = getAccessToken();

    // Build headers with Authorization token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // helper to perform fetch attempt
    const doFetch = async () =>
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ content }),
        signal: controller.signal,
        credentials: "include", // Include cookies for potential refresh token
      });

    let resp = await doFetch();

    // If access token expired the server may return 401. Attempt one refresh+retry cycle.
    if (resp.status === 401) {
      try {
        // Dynamically import auth service to avoid circular imports
        const authSvc = await import("./auth.service");
        // refreshAccessToken will call /auth/refresh and persist new access token
        await authSvc.refreshAccessToken();

        // get updated token and update headers for retry
        const { getAccessToken } = await import("../utils/token.util");
        const newToken = getAccessToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
        } else {
          // no token available after refresh -> throw
          const text = await resp.text().catch(() => "");
          throw new Error(
            text || `Stream request failed with status ${resp.status}`
          );
        }

        // Retry the streaming request once
        resp = await doFetch();
      } catch {
        // If refresh failed, surface original error
        const text = await resp.text().catch(() => "");
        throw new Error(
          text || `Stream request failed with status ${resp.status}`
        );
      }
    }

    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      throw new Error(
        text || `Stream request failed with status ${resp.status}`
      );
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // parse SSE-like `data: {...}\n\n` chunks
      let index;
      while ((index = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, index).trim();
        buf = buf.slice(index + 2);
        // each raw line may contain multiple `data: ` lines; extract payload
        const lines = raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.replace(/^data:\s*/, "");
          try {
            const obj = JSON.parse(payload);

            if (obj.type === "chunk" && typeof obj.text === "string") {
              onChunk(obj.text);
            } else if (obj.type === "done") {
              // Pass the entire result object (userMessage, assistantMessage, conversation)
              onDone(obj);
            } else if (obj.type === "error") {
              onError?.(obj.message);
            }
          } catch {
            // Treat non-JSON payloads as plain text chunks
            onChunk(payload);
          }
        }
      }
    }

    // process any remaining buffer
    if (buf.trim()) {
      const lines = buf
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.replace(/^data:\s*/, "");
        try {
          const obj = JSON.parse(payload);

          if (obj.type === "done") {
            onDone(obj);
          } else if (obj.type === "chunk") {
            onChunk(obj.text);
          } else if (obj.type === "error") {
            onError?.(obj.message);
          }
        } catch {
          onChunk(payload);
        }
      }
    }

    return { abort: () => controller.abort() };
  } catch (err) {
    onError?.(err);
    return { abort: () => controller.abort() };
  }
};

/** Update conversation (rename, change model, etc.) */
export type UpdateConversationPayload = {
  title?: string;
  model?: string;
  context_window?: number;
};

export const updateConversation = async (
  conversationId: string,
  payload: UpdateConversationPayload
): Promise<ConversationType> => {
  const resp = await axiosInstance.patch(
    `/conversations/${conversationId}`,
    payload
  );
  return resp.data.data as ConversationType;
};

/** Delete conversation (soft delete) */
export const deleteConversation = async (
  conversationId: string
): Promise<ConversationListItem[] | void> => {
  const resp = await axiosInstance.delete(`/conversations/${conversationId}`);
  // If server returned refreshed conversations list, return it to caller
  if (resp.data && resp.data.data) {
    return resp.data.data as ConversationListItem[];
  }
  return;
};

export default {
  createConversation,
  getConversations,
  getConversation,
  getMessages,
  updateConversation,
  deleteConversation,
};
