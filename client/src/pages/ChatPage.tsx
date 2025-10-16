/**
 * ChatPage Component
 * Main chat interface with sidebar and message area
 */

import React, { useState, useEffect, useRef } from "react";
import { Layout, Typography, App } from "antd";
import { createConversation as apiCreateConversation } from "../services/chat.service";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import EmptyState from "../components/EmptyState";
import { ConversationSearch } from "../components/ConversationSearch";
import ConversationForm, {
  ConversationFormValues,
} from "../components/ConversationForm";
import { useChat, useWebSocket, useRealTimeChat } from "../hooks";
import {
  Conversation,
  ConversationListItem,
  Message,
} from "../types/chat.type";
import { websocketService } from "../services/websocket.service";
import { NetworkStatus, TypingIndicator } from "../components";
import { searchConversation } from "../services/searchService";
import styles from "./ChatPage.module.css";

const { Content } = Layout;
const { Title } = Typography;

/**
 * ChatPage component
 * Main layout for chat interface with sidebar and message area
 */
const ChatPage: React.FC = () => {
  const { message: antdMessage } = App.useApp();
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Ref to store message DOM elements for scroll-to functionality
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  const {
    conversations,
    isLoading: isLoadingConversations,
    isLoadingMore: isLoadingMoreConversations,
    hasMore: conversationsHasMore,
    loadMore: loadMoreConversations,
    updateConversationOptimistic,
    moveConversationToTop,
    removeConversation,
    refreshConversations,
  } = useChat({ searchQuery, limit: 20 });

  // Message and UI state
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);

  // WebSocket integration
  const { isConnected } = useWebSocket();
  const {
    sendMessage: sendRealtimeMessage,
    isAITyping,
    startTyping,
    stopTyping,
    isSending: isSendingRealtimeMessage,
    joinConversation,
    leaveConversation,
  } = useRealTimeChat({
    conversation: currentConversation,
    onConversationUpdate: (update) => {
      if (currentConversation) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, ...update } : null
        );
      }
    },
  });

  // Message and UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPage, setMessagesPage] = useState<number>(1);
  const [messagesHasMore, setMessagesHasMore] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  // Sidebar is rendered by the new Sidebar component

  // Modal/form state for creating conversation
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  /**
   * Handle search input change
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Load messages for a conversation from server
  const loadMessages = async (conversationId: string, page = 1) => {
    setIsLoadingMessages(true);
    try {
      const svc = await import("../services/chat.service");
      const result = await svc.getMessages(conversationId, page, 20);
      if (page === 1) {
        // initial load: replace messages with the most recent page
        setMessages(result.messages);
      } else {
        // older pages (page > 1): prepend older messages before existing list
        setMessages((prev) => [...result.messages, ...prev]);
      }
      setMessagesPage(result.pagination.page);
      setMessagesHasMore(result.pagination.page < result.pagination.totalPages);
    } catch (err) {
      antdMessage.error("Failed to load messages");
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  /**
   * Handle search result click - scroll to message and highlight
   */
  const handleSearchResultClick = (messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement) {
      // Scroll to message
      messageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Add highlight
      setHighlightedMessageId(messageId);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    }
  };

  /**
   * Handle creating a new conversation
   */
  const openNewConversationModal = () => {
    setIsModalVisible(true);
  };

  const handleNewConversation = () => {
    openNewConversationModal();
  };

  const handleCreateSubmit = async (values: ConversationFormValues) => {
    const payload = {
      title: values.title,
      model: values.model || "gpt-5-nano",
      context_window: values.context_window || 10,
    };

    setIsCreating(true);
    try {
      const conversation = await apiCreateConversation(payload as any);
      antdMessage.success("Conversation created");

      // Close modal and reset
      setIsModalVisible(false);

      // Navigate to conversation URL
      navigate(`/conversations/${conversation.id}`);

      // Refresh conversations list so the new one shows up
      await refreshConversations();

      // Notify other UI parts (Sidebar) to reload conversations list
      try {
        window.dispatchEvent(new Event("conversations:refresh"));
      } catch {}

      // Notify WebSocket for multi-tab sync
      if (isConnected) {
        try {
          websocketService.notifyConversationCreated(conversation as any);
        } catch {}
      } // Set current conversation and clear messages placeholder
      setCurrentConversation(conversation as any);
      setMessages([]);
    } catch (err: any) {
      antdMessage.error(
        err?.response?.data?.message || "Failed to create conversation"
      );
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle selecting a conversation
   */
  const handleSelectConversation = (conversationId: string) => {
    // Navigate to conversation URL which will trigger loader via useEffect
    navigate(`/conversations/${conversationId}`);
  };

  // Auto-load conversation when params.id changes
  // Avoid including `currentConversation` in deps because we set it inside
  // this effect which would cause an infinite loop. Track previous id with a ref
  // so we can leave the old conversation when navigating to a new one.
  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = params.id;
    const prevId = prevConversationIdRef.current;

    // If we previously joined a conversation and the id changed, leave it.
    if (prevId && prevId !== id) {
      leaveConversation(prevId);
    }

    // Update the ref to the current params id
    prevConversationIdRef.current = id || null;

    // If there's no id in params (navigated to '/'), clear current conversation and messages
    if (!id) {
      setCurrentConversation(null);
      setMessages([]);
      setMessagesPage(1);
      setMessagesHasMore(false);
      return;
    }

    const loadConversation = async (convId: string) => {
      setIsLoadingMessages(true);
      try {
        const svc = await import("../services/chat.service");
        const conv = await svc.getConversation(convId);
        setCurrentConversation(conv as any);

        // Join WebSocket room for this conversation will be handled by useRealTimeChat effect

        const result = await svc.getMessages(convId, 1, 20);
        setMessages(result.messages);
        setMessagesPage(result.pagination.page);
        setMessagesHasMore(
          result.pagination.page < result.pagination.totalPages
        );
        // If navigation included a highlight param, try to scroll to that message
        const searchParams = new URLSearchParams(location.search);
        const highlightParam = searchParams.get("highlight");
        if (highlightParam) {
          // Try to find and scroll to the highlighted message. If not present in
          // the initial page, attempt to load older pages (pagination) up to a limit.
          const tryScroll = async (
            pageToTry = result.pagination.page,
            attemptsLeft = 6
          ) => {
            // Give React a moment to render refs
            await new Promise((r) => setTimeout(r, 120));
            const el = messageRefs.current.get(highlightParam);
            if (el) {
              handleSearchResultClick(highlightParam);
              // Remove highlight param from URL to avoid repeated actions
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("highlight");
                window.history.replaceState({}, "", url.toString());
              } catch {}
              return true;
            }

            // If not found and there are more pages, load next (older) page and retry
            if (attemptsLeft > 0 && pageToTry < result.pagination.totalPages) {
              try {
                await loadMessages(convId, pageToTry + 1);
                return tryScroll(pageToTry + 1, attemptsLeft - 1);
              } catch {
                return false;
              }
            }

            return false;
          };

          void tryScroll();
        }
        // If navigation included a q param (from global search), and highlight not found,
        // call the conversation-local search API to find the bestMatch and highlight it.
        const qParam = searchParams.get("q");
        if (qParam && !highlightParam) {
          // Only proceed if no highlight param (to avoid double processing)
          console.log("[ChatPage] Processing ?q param:", qParam);
          try {
            const convSearch = await searchConversation(convId, {
              query: qParam,
              limit: 1,
              contextMessages: 2,
            });
            const bestMatch = convSearch.bestMatch;
            console.log("[ChatPage] Conversation search result:", bestMatch);
            if (bestMatch && bestMatch.message_id) {
              // Wait a bit for refs to be set, then try to highlight
              setTimeout(() => {
                console.log(
                  "[ChatPage] Calling handleSearchResultClick for",
                  bestMatch.message_id
                );
                handleSearchResultClick(bestMatch.message_id);
              }, 200);
              // Remove q param from URL to avoid repeated actions
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("q");
                window.history.replaceState({}, "", url.toString());
              } catch {}
            }
          } catch (err) {
            // Non-fatal: conversation-local search failed, no highlight
            console.debug("ChatPage: conversation-local search failed", err);
          }
        }
        // Ensure message list scrolls to bottom when conversation loads,
        // but skip if we have a highlight or q param (to avoid conflict with highlight scroll).
        const hasHighlightIntent = highlightParam || qParam;
        if (!hasHighlightIntent) {
          try {
            window.dispatchEvent(new Event("messages:scrollToBottom"));
          } catch {}
          try {
            setTimeout(() => {
              try {
                window.dispatchEvent(new Event("messages:scrollToBottom"));
              } catch {}
            }, 120);
          } catch {}
        }
      } catch (err) {
        antdMessage.error("Failed to load conversation");
        setCurrentConversation(null);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadConversation(id);
    // Intentionally omit currentConversation from deps to avoid effect re-run
    // Only depend on params.id and isConnected to prevent infinite loops
  }, [params.id, isConnected]);

  // WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!currentConversation) return;

    const handleMessageChunk = (event: CustomEvent) => {
      const { conversationId, chunk, content } = event.detail;
      if (conversationId !== currentConversation.id) return;

      // Update messages with streaming content. IMPORTANT: keep isTyping=true
      // so subsequent chunks continue to update the same typing placeholder.
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        try {
          // debug logging removed
        } catch {}

        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          lastMessage.isTyping
        ) {
          const next = prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, content } : msg
          );
          try {
            // debug logging removed
          } catch {}
          // Update the typing message with new content, preserve isTyping
          return next;
        }
        return prev;
      });
    };

    const handleMessageComplete = (event: CustomEvent) => {
      const { userMessage, assistantMessage, conversation } = event.detail;
      if (userMessage.conversation_id !== currentConversation.id) return;

      // Replace streaming message with final messages
      setMessages((prev) => {
        // Remove any typing messages
        const withoutTyping = prev.filter((msg) => !msg.isTyping);

        // Build a set of existing message IDs to avoid duplicates
        const existingIds = new Set(withoutTyping.map((m) => m.id));

        // Try to replace an optimistic pending user message (localStatus === 'pending')
        // with the server-provided userMessage to avoid duplicates when using WebSocket.
        let replaced = false;
        const replacedList = withoutTyping.map((m) => {
          if (
            !replaced &&
            m.localStatus === "pending" &&
            m.role === "user" &&
            m.conversation_id === userMessage.conversation_id
          ) {
            replaced = true;
            // mark the server id as existing
            existingIds.add(userMessage.id);
            return userMessage;
          }
          return m;
        });

        // If no optimistic user message found to replace, append the server userMessage
        if (!replaced && userMessage && !existingIds.has(userMessage.id)) {
          replacedList.push(userMessage);
          existingIds.add(userMessage.id);
        }

        // Append assistant message if present and not duplicate
        if (assistantMessage && !existingIds.has(assistantMessage.id)) {
          replacedList.push(assistantMessage);
        }

        return replacedList;
      });

      // Update conversation metadata
      if (conversation) {
        setCurrentConversation((prev) =>
          prev
            ? {
                ...prev,
                total_tokens_used: conversation.total_tokens_used,
                message_count: conversation.message_count,
                updatedAt: new Date().toISOString(),
              }
            : prev
        );
        // Ensure the conversation list reflects the recent activity
        try {
          moveConversationToTop(currentConversation.id);
          updateConversationOptimistic(currentConversation.id, {
            message_count: conversation.message_count,
            updatedAt: new Date().toISOString(),
          });
          // Fire-and-forget refresh to fetch latest conversations from server
          refreshConversations().catch(() => {});

          // Notify WebSocket about conversation activity for multi-tab sync
          if (isConnected) {
            try {
              websocketService.notifyConversationUpdated(
                currentConversation.id,
                {
                  message_count: conversation.message_count,
                  updatedAt: new Date().toISOString(),
                }
              );
            } catch {}
          }
        } catch {}
      }
    };

    // Add event listeners
    window.addEventListener(
      "message:chunk",
      handleMessageChunk as EventListener
    );
    window.addEventListener(
      "message:complete",
      handleMessageComplete as EventListener
    );
    const handleMessageNew = (event: CustomEvent) => {
      const { conversationId, message } = event.detail;
      if (conversationId !== currentConversation?.id) return;

      setMessages((prev) => {
        // Avoid duplicates: if message id already exists, don't add
        if (prev.some((m) => m.id === message.id)) return prev;

        // If there's an optimistic pending user message with the same content,
        // don't append the server user message here. It will be reconciled
        // by the `message:complete` handler. This prevents the sender tab from
        // showing the user message twice.
        const hasMatchingPending = prev.some(
          (m) =>
            m.localStatus === "pending" &&
            m.role === "user" &&
            m.conversation_id === message.conversation_id &&
            String(m.content || "").trim() ===
              String(message.content || "").trim()
        );
        if (hasMatchingPending) return prev;

        // Otherwise append normally
        return [...prev, message];
      });
    };

    const handleConversationDeleted = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      // If current conversation is deleted, redirect to home
      if (conversationId === currentConversation?.id) {
        navigate("/", { replace: true });
      }
    };

    const handleAITypingStart = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      if (conversationId !== currentConversation?.id) return;

      // Add AI typing message if not already present
      setMessages((prev) => {
        const hasTyping = prev.some(
          (m) => m.role === "assistant" && m.isTyping
        );
        if (hasTyping) return prev;

        const typingId = `typing_ai_${Date.now()}`;
        const typingMsg: Message = {
          id: typingId,
          conversation_id: conversationId,
          role: "assistant",
          content: "",
          tokens_used: 0,
          model: currentConversation?.model || "gpt-5-nano",
          createdAt: new Date().toISOString(),
          isTyping: true,
        };
        return [...prev, typingMsg];
      });
    };

    const handleAITypingStop = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      if (conversationId !== currentConversation?.id) return;

      // Remove AI typing messages
      setMessages((prev) => prev.filter((m) => !m.isTyping));
    };

    window.addEventListener("message:new", handleMessageNew as EventListener);
    window.addEventListener(
      "conversation:deleted",
      handleConversationDeleted as EventListener
    );
    window.addEventListener(
      "ai:typing:start",
      handleAITypingStart as EventListener
    );
    window.addEventListener(
      "ai:typing:stop",
      handleAITypingStop as EventListener
    );

    return () => {
      window.removeEventListener(
        "message:chunk",
        handleMessageChunk as EventListener
      );
      window.removeEventListener(
        "message:complete",
        handleMessageComplete as EventListener
      );
      window.removeEventListener(
        "message:new",
        handleMessageNew as EventListener
      );
      window.removeEventListener(
        "conversation:deleted",
        handleConversationDeleted as EventListener
      );
      window.removeEventListener(
        "ai:typing:start",
        handleAITypingStart as EventListener
      );
      window.removeEventListener(
        "ai:typing:stop",
        handleAITypingStop as EventListener
      );
    };
  }, [currentConversation]);

  /**
   * Handle sending a message
   */
  const handleSendMessage = async (content: string) => {
    // Prevent sending if already sending or no conversation selected
    if (isSendingMessage || isSendingRealtimeMessage || !currentConversation)
      return;

    // Use WebSocket if connected, otherwise fallback to HTTP
    if (isConnected) {
      try {
        // Add optimistic user message
        const tempId = `temp_${Date.now()}`;
        const userMsg: Message = {
          id: tempId,
          conversation_id: currentConversation.id,
          role: "user",
          content,
          tokens_used: 0,
          model: currentConversation.model,
          createdAt: new Date().toISOString(),
          localStatus: "pending",
        };
        setMessages((prev) => [...prev, userMsg]);
        // scroll to show optimistic user message
        try {
          setTimeout(
            () => window.dispatchEvent(new Event("messages:scrollToBottom")),
            40
          );
        } catch {}

        // Don't add typing indicator here - server will broadcast ai:typing:start to all clients
        await sendRealtimeMessage(content);
        // Optimistically move conversation to top and refresh sidebar immediately
        try {
          moveConversationToTop(currentConversation.id);
          updateConversationOptimistic(currentConversation.id, {
            message_count: (currentConversation.message_count || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
          // Wait for the conversation list to refresh so the sidebar reflects ordering immediately
          await refreshConversations();
          try {
            window.dispatchEvent(new Event("message:sent"));
          } catch {}
        } catch (err) {
          // refreshConversations failed (log suppressed)
        }
        return;
      } catch (err) {
        // WebSocket send failed, falling back to HTTP (log suppressed)
        // Remove optimistic messages on error
        setMessages((prev) =>
          prev.filter(
            (msg) => !msg.localStatus || msg.localStatus !== "pending"
          )
        );
        setMessages((prev) => prev.filter((msg) => !msg.isTyping));

        // Dispatch ai:typing:stop to reset isAITyping state if WebSocket failed
        try {
          window.dispatchEvent(
            new CustomEvent("ai:typing:stop", {
              detail: { conversationId: currentConversation.id },
            })
          );
        } catch {}
      }
    }

    // Fallback to HTTP streaming
    // Optimistically add user message to the list
    const tempId = `temp_${Date.now()}`;
    const userMsg: Message = {
      id: tempId,
      conversation_id: currentConversation.id,
      role: "user",
      content,
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      localStatus: "pending",
    };

    // Optimistically add user message
    setMessages((prev) => [...prev, userMsg]);
    setIsSendingMessage(true);

    // add assistant typing placeholder
    const typingId = `typing_${Date.now()}`;
    const typingMsg: Message = {
      id: typingId,
      conversation_id: currentConversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);
    // scroll so typing placeholder is visible
    try {
      setTimeout(
        () => window.dispatchEvent(new Event("messages:scrollToBottom")),
        60
      );
    } catch {}

    (async () => {
      try {
        const svc = await import("../services/chat.service");

        await svc.sendMessageStream(
          currentConversation.id,
          content,
          // onChunk: append chunk to typing message content
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === typingId
                  ? { ...m, content: (m.content || "") + chunk }
                  : m
              )
            );
          },
          // onDone: replace typing placeholder and update user message
          (result: any) => {
            const userMsg: any = result?.userMessage;
            const assistantMsg: any = result?.assistantMessage;

            setMessages((prev) => {
              // remove typing placeholder
              const withoutTyping = prev.filter((m) => m.id !== typingId);

              // replace optimistic user message (tempId) with server userMessage if provided
              let replacedList = withoutTyping.map((m) =>
                m.id === tempId && userMsg ? userMsg : m
              );

              // If server didn't return a userMessage, but there is still no matching
              // optimistic message, append server user msg (defensive)
              if (userMsg && !replacedList.some((m) => m.id === userMsg.id)) {
                replacedList.push(userMsg);
              }

              // append assistant message from server (final)
              if (assistantMsg) replacedList.push(assistantMsg);

              return replacedList;
            });

            // ensure final messages are visible after server completes
            try {
              setTimeout(
                () =>
                  window.dispatchEvent(new Event("messages:scrollToBottom")),
                40
              );
            } catch {}

            // refresh conversation metadata if present and force reload of conversation list
            if ((result as any)?.conversation) {
              const conv = (result as any).conversation;
              setCurrentConversation((prev) =>
                prev
                  ? {
                      ...prev,
                      total_tokens_used: conv.total_tokens_used,
                      message_count: conv.message_count,
                      updatedAt: new Date().toISOString(),
                    }
                  : prev
              );

              // Move conversation to top and update optimistic metadata
              try {
                moveConversationToTop(currentConversation.id);
                updateConversationOptimistic(currentConversation.id, {
                  message_count: conv.message_count,
                  updatedAt: new Date().toISOString(),
                });
                // force refresh and wait so UI shows most recent ordering immediately
                refreshConversations().catch(
                  (err) =>
                    // suppressed debug
                    null
                );
                try {
                  window.dispatchEvent(new Event("message:sent"));
                } catch {}
              } catch (err) {
                console.debug("move/update conversation failed:", err);
              }
            }

            // Dispatch ai:typing:stop to reset isAITyping state (for HTTP fallback)
            try {
              window.dispatchEvent(
                new CustomEvent("ai:typing:stop", {
                  detail: { conversationId: currentConversation.id },
                })
              );
            } catch {}
          },
          (err) => {
            antdMessage.error("Failed to stream AI response");
            // mark optimistic user as failed
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, localStatus: "failed" } : m
              )
            );
            // remove typing placeholder
            setMessages((prev) => prev.filter((m) => m.id !== typingId));

            // Dispatch ai:typing:stop to reset isAITyping state (for HTTP fallback error)
            try {
              window.dispatchEvent(
                new CustomEvent("ai:typing:stop", {
                  detail: { conversationId: currentConversation.id },
                })
              );
            } catch {}
          }
        );
      } catch (err) {
        antdMessage.error("Failed to send message");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, localStatus: "failed" } : m
          )
        );
        setMessages((prev) => prev.filter((m) => m.id !== typingId));

        // Dispatch ai:typing:stop to reset isAITyping state (for HTTP fallback error)
        try {
          window.dispatchEvent(
            new CustomEvent("ai:typing:stop", {
              detail: { conversationId: currentConversation.id },
            })
          );
        } catch {}
      } finally {
        setIsSendingMessage(false);
      }
    })();
  };

  // Load earlier messages (pagination)
  const loadEarlier = async () => {
    if (!currentConversation) return;
    const nextPage = messagesPage + 1;
    try {
      await loadMessages(currentConversation.id, nextPage);
    } catch (err) {
      antdMessage.error("Failed to load earlier messages");
    }
  };

  // Retry handler for failed messages
  const handleRetryMessage = async (failedMessage: Message) => {
    if (!currentConversation) return;
    // mark pending
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMessage.id ? { ...m, localStatus: "pending" } : m
      )
    );
    // add typing placeholder
    const typingId = `typing_retry_${Date.now()}`;
    const typingMsg: Message = {
      id: typingId,
      conversation_id: currentConversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      setIsSendingMessage(true);
      const svc = await import("../services/chat.service");

      await svc.sendMessageStream(
        currentConversation.id,
        failedMessage.content,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingId
                ? { ...m, content: (m.content || "") + chunk }
                : m
            )
          );
        },
        (result: any) => {
          const userMsg = result?.userMessage;
          const assistantMsg = result?.assistantMessage;

          setMessages((prev) => {
            const withoutTyping = prev.filter((m) => m.id !== typingId);
            const replaced = withoutTyping.map((m) =>
              m.id === failedMessage.id && userMsg ? userMsg : m
            );
            if (assistantMsg) return [...replaced, assistantMsg];
            return replaced;
          });

          if (result?.conversation) {
            setCurrentConversation((prev) =>
              prev
                ? {
                    ...prev,
                    total_tokens_used: result.conversation.total_tokens_used,
                    message_count: result.conversation.message_count,
                  }
                : prev
            );

            // Optimistically move conversation to top
            moveConversationToTop(currentConversation.id);
            updateConversationOptimistic(currentConversation.id, {
              message_count: result.conversation.message_count,
              updatedAt: new Date().toISOString(),
            });

            // Notify sidebar and background sync
            try {
              window.dispatchEvent(new Event("message:sent"));
            } catch {}
            refreshConversations().catch(() => {});
          }

          // Dispatch ai:typing:stop to reset isAITyping state (for retry success)
          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        (err) => {
          antdMessage.error("Retry failed");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === failedMessage.id ? { ...m, localStatus: "failed" } : m
            )
          );

          // Dispatch ai:typing:stop to reset isAITyping state (for retry error)
          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        }
      );
    } catch (err) {
      antdMessage.error("Retry failed");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMessage.id ? { ...m, localStatus: "failed" } : m
        )
      );

      // Dispatch ai:typing:stop to reset isAITyping state (for retry catch error)
      try {
        window.dispatchEvent(
          new CustomEvent("ai:typing:stop", {
            detail: { conversationId: currentConversation.id },
          })
        );
      } catch {}
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <Layout className={styles.chatPageLayout}>
      <Layout className={styles.mainLayout}>
        {/* Sidebar component */}
        <Sidebar
          currentConversationId={currentConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onHighlightMessage={handleSearchResultClick}
        />

        {/* Main content area */}
        <Content className={styles.contentArea}>
          {/* Main content */}

          {/* Show empty state or messages */}
          {!currentConversation ? (
            <EmptyState type="messages" onAction={handleNewConversation} />
          ) : (
            <>
              {/* Conversation header */}
              <div className={styles.conversationHeader}>
                <div className={styles.conversationHeaderLeft}>
                  <Title level={4} className={styles.conversationTitle}>
                    {currentConversation.title}
                  </Title>
                  <NetworkStatus position="inline" />
                </div>

                {/* Semantic Search within conversation */}
                <div className={styles.conversationSearchContainer}>
                  <ConversationSearch
                    conversationId={currentConversation.id}
                    onResultClick={handleSearchResultClick}
                  />
                </div>
              </div>

              {/* Messages list */}
              <MessageList
                messages={messages}
                isLoading={isSendingMessage || isSendingRealtimeMessage}
                showScrollButton
                onLoadEarlier={loadEarlier}
                hasMore={messagesHasMore}
                onRetry={handleRetryMessage}
                messageRefs={messageRefs}
                highlightedMessageId={highlightedMessageId}
              />

              {/* Chat input - disable while AI is typing to mirror sender tab behaviour */}
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={
                  isAITyping || isSendingMessage || isSendingRealtimeMessage
                }
                placeholder="Type your message here..."
                onTypingStart={() => isConnected && startTyping()}
                onTypingStop={() => isConnected && stopTyping()}
              />
            </>
          )}
        </Content>
      </Layout>

      {/* New Conversation Modal */}
      <ConversationForm
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onSubmit={handleCreateSubmit}
        loading={isCreating}
      />
    </Layout>
  );
};

export default ChatPage;
