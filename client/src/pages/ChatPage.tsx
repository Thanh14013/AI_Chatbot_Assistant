/**
 * ChatPage Component
 * Main chat interface with sidebar and message area
 */

import React, { useState, useEffect, useRef } from "react";
import { Layout, Typography, App } from "antd";
import {
  createConversation as apiCreateConversation,
  generateConversationTitle as apiGenerateTitle,
  updateConversation as apiUpdateConversation,
} from "../services/chat.service";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import type { FileAttachment } from "../types/file.types";
import { ConversationSearch } from "../components/ConversationSearch";
import {
  SettingsModal,
  ProfileModal,
  PinnedMessagesDropdown,
} from "../components";
// ConversationForm not used anymore in new draft mode flow
// import ConversationForm, {
//   ConversationFormValues,
// } from "../components/ConversationForm";
import { useChat, useWebSocket, useRealTimeChat } from "../hooks";
import {
  Conversation,
  ConversationListItem,
  Message,
} from "../types/chat.type";
import { PendingMessage } from "../types/offline-message.type";
import { websocketService } from "../services/websocket.service";
import { NetworkStatus, TypingIndicator } from "../components";
import { searchConversation } from "../services/searchService";
import { useAuthContext } from "../hooks/useAuthContext";
import { usePreferences } from "../stores/preferences.store";
import styles from "./ChatPage.module.css";

const { Content } = Layout;
const { Title } = Typography;

/**
 * ChatPage component
 * Main layout for chat interface with sidebar and message area
 */
const ChatPage: React.FC = () => {
  const { message: antdMessage } = App.useApp();
  const { user } = useAuthContext();

  // Fetch user preferences on mount
  const { fetchPreferences } = usePreferences();

  // Settings modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Profile modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  // Pinned messages refresh trigger
  const [pinnedRefreshTrigger, setPinnedRefreshTrigger] = useState(0);

  // Unread tracking state (multi-tab)
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(
    new Set()
  );

  // Conversation followup suggestions state
  const [conversationSuggestions, setConversationSuggestions] = useState<
    string[]
  >([]);
  const [
    isLoadingConversationSuggestions,
    setIsLoadingConversationSuggestions,
  ] = useState(false);

  // Sidebar is rendered by the new Sidebar component

  // Modal/form state for creating conversation - deprecated in draft mode
  // const [isModalVisible, setIsModalVisible] = useState(false);
  // const [isCreating, setIsCreating] = useState(false);
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
   * Deprecated: Modal approach replaced with inline draft mode
   */
  /*
  const openNewConversationModal = () => {
    setIsModalVisible(true);
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

      setIsModalVisible(false);

      navigate(`/conversations/${conversation.id}`);

      await refreshConversations();

      try {
        window.dispatchEvent(new Event("conversations:refresh"));
      } catch {}

      if (isConnected) {
        try {
          websocketService.notifyConversationCreated(conversation as any);
        } catch {}
      }
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
  */

  /**
   * Handle New Conversation button click
   * Navigate to home route to show empty chat (draft mode)
   */
  const handleNewConversation = () => {
    // Navigate to home route to show empty chat interface
    navigate("/");
    // Clear current conversation to show draft mode
    setCurrentConversation(null);
    setMessages([]);
    setMessagesPage(1);
    setMessagesHasMore(false);
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

  // Track newly created conversations to avoid race condition with message loading
  const justCreatedConversationIdRef = useRef<string | null>(null);

  // Fetch user preferences on mount (auto-creates if doesn't exist)
  useEffect(() => {
    fetchPreferences().catch((err) => {});
  }, [fetchPreferences]);

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      antdMessage.success("Connection restored. You can now send messages.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      antdMessage.warning(
        "Connection lost. Messages will be queued and sent when online."
      );

      // Mark all pending/sending messages as failed when going offline
      setMessages((prev) =>
        prev.map((msg) =>
          msg.localStatus === "pending" || msg.localStatus === "sending"
            ? {
                ...msg,
                localStatus: "failed",
                errorMessage: "Connection lost. Click retry when online.",
                lastAttemptAt: new Date().toISOString(),
              }
            : msg
        )
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [antdMessage]);

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

        // Skip loading messages if this conversation was just created
        // (to avoid race condition where we clear optimistic messages)
        const isJustCreated = justCreatedConversationIdRef.current === convId;
        if (isJustCreated) {
          // Clear the flag after using it
          justCreatedConversationIdRef.current = null;
          setIsLoadingMessages(false);
          return;
        }

        const result = await svc.getMessages(convId, 1, 20);
        setMessages(result.messages);
        setMessagesPage(result.pagination.page);
        setMessagesHasMore(
          result.pagination.page < result.pagination.totalPages
        );
        // If navigation included a q param (from global search), and highlight not found,
        // call the conversation-local search API to find the bestMatch and highlight it.
        const searchParams = new URLSearchParams(location.search);
        const qParam = searchParams.get("q");
        const highlightParam = searchParams.get("highlight");
        if (qParam) {
          // Only proceed if no highlight param (to avoid double processing)

          try {
            const convSearch = await searchConversation(convId, {
              query: qParam,
              limit: 1,
              contextMessages: 2,
            });
            const bestMatch = convSearch.bestMatch;

            if (bestMatch && bestMatch.message_id) {
              // Wait a bit for refs to be set, then try to highlight
              setTimeout(() => {
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

      if (userMessage.conversation_id !== currentConversation.id) {
        return;
      }

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

      if (conversationId !== currentConversation?.id) {
        return;
      }

      setMessages((prev) => {
        // Avoid duplicates: if message id already exists, don't add
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }

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
        if (hasMatchingPending) {
          return prev;
        }

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
   * Handle unread status tracking (multi-tab)
   * - Emit conversation:view when user opens a conversation
   * - Listen for unread status updates from server
   */
  useEffect(() => {
    // Emit view event when currentConversation changes
    if (currentConversation && isConnected) {
      websocketService.viewConversation(currentConversation.id);

      // Mark as read immediately in local state
      setUnreadConversations((prev) => {
        const next = new Set(prev);
        next.delete(currentConversation.id);
        return next;
      });
    }

    // Cleanup: emit leave_view when unmounting or switching conversation
    return () => {
      if (currentConversation && isConnected) {
        websocketService.leaveConversationView(currentConversation.id);
      }
    };
  }, [currentConversation?.id, isConnected]);

  /**
   * Listen for unread status updates from WebSocket
   */
  useEffect(() => {
    const handleUnreadStatus = (event: CustomEvent) => {
      const { conversationId, hasUnread } = event.detail;

      setUnreadConversations((prev) => {
        const next = new Set(prev);
        if (hasUnread) {
          next.add(conversationId);
        } else {
          next.delete(conversationId);
        }
        return next;
      });
    };

    window.addEventListener(
      "conversation:unread_status",
      handleUnreadStatus as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation:unread_status",
        handleUnreadStatus as EventListener
      );
    };
  }, []);

  // Listen for location changes to handle highlight params from navigation
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const highlightParam = searchParams.get("highlight");

    if (highlightParam && currentConversation && messages.length > 0) {
      // Try to find and highlight the message
      const tryHighlight = async (attemptsLeft = 6) => {
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
        if (attemptsLeft > 0 && messagesHasMore) {
          try {
            await loadEarlier();
            return tryHighlight(attemptsLeft - 1);
          } catch {
            return false;
          }
        }

        return false;
      };

      void tryHighlight();
    }
  }, [location.search, currentConversation, messages.length, messagesHasMore]);

  /**
   * Handle sending a message
   */
  const handleSendMessage = async (
    content: string,
    attachments?: FileAttachment[]
  ) => {
    // Prevent sending if already sending
    if (isSendingMessage || isSendingRealtimeMessage) return;

    // Check if offline
    if (!isOnline) {
      antdMessage.warning(
        "You are offline. Please check your connection and try again."
      );
      return;
    }

    // Clear conversation suggestions when sending a message
    setConversationSuggestions([]);
    setIsLoadingConversationSuggestions(false);

    // ============ NEW CONVERSATION FLOW ============
    if (!currentConversation) {
      setIsSendingMessage(true);

      try {
        // Step 1: Generate title - nếu <= 4 từ thì dùng message, nếu > 4 từ thì dùng "New Chat"
        const wordCount = content.trim().split(/\s+/).length;
        let title: string;

        if (wordCount <= 4) {
          // Message ngắn: dùng trực tiếp làm title
          title = content.trim();
        } else {
          // Message dài: dùng "New Chat"
          title = "New Chat";
        }

        // Validate title before creating conversation
        if (!title || title.trim().length === 0) {
          title = "New Chat";
        }

        // Step 2: Create conversation
        const newConversation = await apiCreateConversation({
          title,
          model: "gpt-5-nano",
          context_window: 10,
        });

        // Mark this conversation as just created to skip message reload
        justCreatedConversationIdRef.current = newConversation.id;

        // Step 3: Set current conversation (without navigation yet)
        setCurrentConversation(newConversation as any);

        // IMPORTANT: Join WebSocket room immediately before sending message
        // (useEffect auto-join may not run in time)
        if (isConnected) {
          joinConversation(newConversation.id);
        }

        // Step 4: Notify WebSocket about conversation creation
        if (isConnected) {
          try {
            websocketService.notifyConversationCreated(newConversation as any);
          } catch {}
        }

        // Refresh conversations list
        refreshConversations().catch(() => {});
        try {
          window.dispatchEvent(new Event("conversations:refresh"));
        } catch {}

        // Step 5: Add optimistic user message
        const tempId = `temp_${Date.now()}`;
        const userMsg: Message = {
          id: tempId,
          conversation_id: newConversation.id,
          role: "user",
          content,
          tokens_used: 0,
          model: newConversation.model,
          createdAt: new Date().toISOString(),
          localStatus: "pending",
          attachments: attachments?.map((att) => ({
            id: att.id,
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            original_filename: att.original_filename,
            size_bytes: att.size_bytes,
            width: att.width,
            height: att.height,
            thumbnail_url: att.thumbnail_url,
            extracted_text: att.extracted_text,
          })),
        };
        setMessages([userMsg]);

        // Scroll to show user message
        try {
          setTimeout(
            () => window.dispatchEvent(new Event("messages:scrollToBottom")),
            40
          );
        } catch {}

        // Navigate to conversation URL after a short delay
        // This allows message sending to start before useEffect triggers
        setTimeout(() => {
          navigate(`/conversations/${newConversation.id}`, { replace: true });
        }, 50);

        // Wait a tiny bit for state updates to propagate before sending
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Step 6: Try sending via WebSocket first
        if (isConnected) {
          try {
            // logging removed: attempting WebSocket send

            // Send directly via websocketService instead of hook
            // (hook may not have updated conversation prop yet)
            websocketService.sendMessage(
              newConversation.id,
              content,
              attachments?.map((att) => ({
                public_id: att.public_id,
                secure_url: att.secure_url,
                resource_type: att.resource_type,
                format: att.format,
                extracted_text: att.extracted_text,
              }))
            );

            // logging removed: WebSocket send initiated

            // Update conversation metadata optimistically
            try {
              moveConversationToTop(newConversation.id);
              updateConversationOptimistic(newConversation.id, {
                message_count: 1,
                updatedAt: new Date().toISOString(),
              });
              refreshConversations().catch(() => {});
              window.dispatchEvent(new Event("message:sent"));
            } catch {}

            setIsSendingMessage(false);

            // WebSocket is fire-and-forget, response will come via event listeners
            // Don't return here - let HTTP fallback handle if WebSocket fails
            // Actually, we should wait a bit to see if WebSocket succeeds
            await new Promise((resolve) => setTimeout(resolve, 500));

            // If we're still here and no error, assume success
            // logging removed: WebSocket send assumed successful
            return;
          } catch (err) {
            // logging removed: WebSocket send failed, falling back to HTTP
            // Continue to HTTP fallback
          }
        } else {
          // logging removed: WebSocket not connected, using HTTP directly
        }

        // Step 7: Fallback to HTTP streaming
        // logging removed: starting HTTP fallback

        // Add typing indicator
        const typingId = `typing_${Date.now()}`;
        const typingMsg: Message = {
          id: typingId,
          conversation_id: newConversation.id,
          role: "assistant",
          content: "",
          tokens_used: 0,
          model: newConversation.model,
          createdAt: new Date().toISOString(),
          isTyping: true,
        };
        setMessages((prev) => [...prev, typingMsg]);

        // logging removed: added typing indicator, sending HTTP request

        try {
          const svc = await import("../services/chat.service");
          await svc.sendMessageStream(
            newConversation.id,
            content,
            // onChunk
            (chunk) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === typingId
                    ? { ...m, content: (m.content || "") + chunk }
                    : m
                )
              );
            },
            // onDone
            (result: any) => {
              // logging removed: HTTP response received
              const serverUserMsg = result?.userMessage;
              const assistantMsg = result?.assistantMessage;

              setMessages((prev) => {
                // Remove typing indicator
                const withoutTyping = prev.filter((m) => m.id !== typingId);

                // Replace optimistic user message with server version
                let replacedList = withoutTyping.map((m) =>
                  m.id === tempId && serverUserMsg ? serverUserMsg : m
                );

                // Add server user message if not already present
                if (
                  serverUserMsg &&
                  !replacedList.some((m) => m.id === serverUserMsg.id)
                ) {
                  replacedList.push(serverUserMsg);
                }

                // Add assistant message
                if (assistantMsg) {
                  replacedList.push(assistantMsg);
                }

                return replacedList;
              });

              // Scroll to bottom
              try {
                setTimeout(
                  () =>
                    window.dispatchEvent(new Event("messages:scrollToBottom")),
                  40
                );
              } catch {}

              // Update conversation metadata
              if (result?.conversation) {
                const conv = result.conversation;
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

                try {
                  moveConversationToTop(newConversation.id);
                  updateConversationOptimistic(newConversation.id, {
                    message_count: conv.message_count,
                    updatedAt: new Date().toISOString(),
                  });
                  refreshConversations().catch(() => {});
                  window.dispatchEvent(new Event("message:sent"));
                } catch {}
              }
            },
            // onError
            (err) => {
              antdMessage.error("Failed to send message");
              // Mark optimistic message as failed
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId ? { ...m, localStatus: "failed" } : m
                )
              );
              // Remove typing indicator
              setMessages((prev) => prev.filter((m) => m.id !== typingId));
            },
            // attachments
            attachments?.map((att) => ({
              public_id: att.public_id,
              secure_url: att.secure_url,
              resource_type: att.resource_type,
              format: att.format,
              extracted_text: att.extracted_text,
            }))
          );
        } catch (err) {
          antdMessage.error("Failed to send message");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, localStatus: "failed" } : m
            )
          );
          setMessages((prev) => prev.filter((m) => m.id !== typingId));
        } finally {
          setIsSendingMessage(false);
        }

        return; // End of new conversation flow
      } catch (err: any) {
        antdMessage.error(
          err?.response?.data?.message || "Failed to create conversation"
        );
        setCurrentConversation(null);
        setMessages([]);
        setIsSendingMessage(false);
        return;
      }
    }

    // ============ EXISTING CONVERSATION FLOW ============
    if (isConnected) {
      const tempId = `temp_${Date.now()}`;
      const userMsg: Message = {
        id: tempId,
        conversation_id: currentConversation.id,
        role: "user",
        content,
        tokens_used: 0,
        model: currentConversation.model,
        createdAt: new Date().toISOString(),
        localStatus: "sending",
        retryCount: 0,
        attachments: attachments?.map((att) => ({
          id: att.id,
          public_id: att.public_id,
          secure_url: att.secure_url,
          resource_type: att.resource_type,
          format: att.format,
          original_filename: att.original_filename,
          size_bytes: att.size_bytes,
          width: att.width,
          height: att.height,
          thumbnail_url: att.thumbnail_url,
          extracted_text: att.extracted_text,
        })),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        setTimeout(
          () => window.dispatchEvent(new Event("messages:scrollToBottom")),
          40
        );
      } catch {}

      try {
        // Mark as pending while sending
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, localStatus: "pending" } : m
          )
        );

        // Send with attachments
        await sendRealtimeMessage(
          content,
          attachments?.map((att) => ({
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            extracted_text: att.extracted_text,
          }))
        );

        // Mark as sent on success
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, localStatus: "sent" } : m))
        );

        try {
          moveConversationToTop(currentConversation.id);
          updateConversationOptimistic(currentConversation.id, {
            message_count: (currentConversation.message_count || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
          await refreshConversations();
          window.dispatchEvent(new Event("message:sent"));
        } catch {}

        return;
      } catch (err: unknown) {
        const error = err as Error & { code?: string };
        const errorMsg =
          error.code === "WEBSOCKET_DISCONNECTED"
            ? "Connection lost. Message will be retried."
            : error.message || "Failed to send message";

        // Mark message as failed with error details
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  localStatus: "failed",
                  errorMessage: errorMsg,
                  lastAttemptAt: new Date().toISOString(),
                }
              : m
          )
        );

        // Remove typing indicators
        setMessages((prev) => prev.filter((msg) => !msg.isTyping));

        try {
          window.dispatchEvent(
            new CustomEvent("ai:typing:stop", {
              detail: { conversationId: currentConversation.id },
            })
          );
        } catch {}

        antdMessage.error(
          `Failed to send message: ${errorMsg}. Click retry to try again.`
        );

        // Don't return - continue to HTTP fallback
      }
    }

    // HTTP fallback for existing conversation
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
      attachments: attachments?.map((att) => ({
        id: att.id,
        public_id: att.public_id,
        secure_url: att.secure_url,
        resource_type: att.resource_type,
        format: att.format,
        original_filename: att.original_filename,
        size_bytes: att.size_bytes,
        width: att.width,
        height: att.height,
        thumbnail_url: att.thumbnail_url,
        extracted_text: att.extracted_text,
      })),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSendingMessage(true);

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

    try {
      setTimeout(
        () => window.dispatchEvent(new Event("messages:scrollToBottom")),
        60
      );
    } catch {}

    try {
      const svc = await import("../services/chat.service");
      await svc.sendMessageStream(
        currentConversation.id,
        content,
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
          const serverUserMsg = result?.userMessage;
          const assistantMsg = result?.assistantMessage;

          setMessages((prev) => {
            const withoutTyping = prev.filter((m) => m.id !== typingId);
            let replacedList = withoutTyping.map((m) =>
              m.id === tempId && serverUserMsg ? serverUserMsg : m
            );
            if (
              serverUserMsg &&
              !replacedList.some((m) => m.id === serverUserMsg.id)
            ) {
              replacedList.push(serverUserMsg);
            }
            if (assistantMsg) replacedList.push(assistantMsg);
            return replacedList;
          });

          try {
            setTimeout(
              () => window.dispatchEvent(new Event("messages:scrollToBottom")),
              40
            );
          } catch {}

          if (result?.conversation) {
            const conv = result.conversation;
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

            try {
              moveConversationToTop(currentConversation.id);
              updateConversationOptimistic(currentConversation.id, {
                message_count: conv.message_count,
                updatedAt: new Date().toISOString(),
              });
              refreshConversations().catch(() => {});
              window.dispatchEvent(new Event("message:sent"));
            } catch {}
          }

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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, localStatus: "failed" } : m
            )
          );
          setMessages((prev) => prev.filter((m) => m.id !== typingId));

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
        prev.map((m) => (m.id === tempId ? { ...m, localStatus: "failed" } : m))
      );
      setMessages((prev) => prev.filter((m) => m.id !== typingId));

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

  // Helper function để tránh duplicate logic
  const sendMessageViaWebSocketOrHTTP = async (
    conversation: Conversation,
    content: string,
    tempId: string,
    userMsg: Message,
    attachments?: FileAttachment[]
  ) => {
    // Try WebSocket first
    if (isConnected) {
      try {
        await sendRealtimeMessage(
          content,
          attachments?.map((att) => ({
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            extracted_text: att.extracted_text,
          }))
        );
        moveConversationToTop(conversation.id);
        await refreshConversations();
        return true;
      } catch (err) {}
    }

    // Fallback to HTTP
    const typingMsg: Message = {
      id: `typing_${Date.now()}`,
      conversation_id: conversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: conversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      const svc = await import("../services/chat.service");
      await svc.sendMessageStream(
        conversation.id,
        content,
        (chunk) => {
          /* handle chunk */
        },
        (result) => {
          /* handle completion */
        },
        (err) => {
          /* handle error */
        }
      );
      return true;
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, localStatus: "failed" } : m))
      );
      return false;
    }
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

  // Retry handler for failed messages with exponential backoff
  const handleRetryMessage = async (
    failedMessage: Message | PendingMessage
  ): Promise<void> => {
    if (!currentConversation) return;

    const retryCount = (failedMessage as Message).retryCount || 0;
    const maxRetries = 3;

    // Check if max retries reached
    if (retryCount >= maxRetries) {
      antdMessage.error(`Maximum retry attempts (${maxRetries}) reached`);
      return;
    }

    // Calculate exponential backoff delay: 1s, 2s, 4s
    const backoffDelay = Math.pow(2, retryCount) * 1000;

    // Mark as sending (show loading state)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMessage.id
          ? {
              ...m,
              localStatus: "sending",
              retryCount: retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
            }
          : m
      )
    );

    // Wait for backoff delay
    if (retryCount > 0) {
      antdMessage.info(`Retrying in ${backoffDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    // Try WebSocket first if connected
    if (isConnected) {
      try {
        // Mark as pending for WebSocket attempt
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMessage.id ? { ...m, localStatus: "pending" } : m
          )
        );

        // Send via WebSocket
        websocketService.sendMessage(
          currentConversation.id,
          failedMessage.content,
          undefined // No attachments on retry (already uploaded previously)
        );

        // Success message will be handled by WebSocket event listeners
        antdMessage.success("Message sent successfully");
        return;
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        // WebSocket failed, fallback to HTTP
        antdMessage.warning("WebSocket failed, trying HTTP...");

        // Mark with error for potential retry
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMessage.id
              ? {
                  ...m,
                  errorMessage:
                    err.code === "WEBSOCKET_DISCONNECTED"
                      ? "Connection lost"
                      : "Failed to send",
                }
              : m
          )
        );
      }
    }

    // HTTP fallback
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
        (result: unknown) => {
          const res = result as {
            userMessage?: Message;
            assistantMessage?: Message;
            conversation?: {
              total_tokens_used: number;
              message_count: number;
            };
          };
          const userMsg = res?.userMessage;
          const assistantMsg = res?.assistantMessage;

          setMessages((prev) => {
            const withoutTyping = prev.filter((m) => m.id !== typingId);
            const replaced = withoutTyping.map((m) =>
              m.id === failedMessage.id && userMsg
                ? { ...userMsg, localStatus: "sent" as const }
                : m
            );
            if (assistantMsg) return [...replaced, assistantMsg];
            return replaced;
          });

          if (res?.conversation) {
            setCurrentConversation((prev) =>
              prev && res.conversation
                ? {
                    ...prev,
                    total_tokens_used: res.conversation.total_tokens_used,
                    message_count: res.conversation.message_count,
                  }
                : prev
            );

            moveConversationToTop(currentConversation.id);
            updateConversationOptimistic(currentConversation.id, {
              message_count: res.conversation.message_count,
              updatedAt: new Date().toISOString(),
            });

            try {
              window.dispatchEvent(new Event("message:sent"));
            } catch {}
            refreshConversations().catch(() => {});
          }

          antdMessage.success("Message sent successfully");

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        (err: unknown) => {
          const error = err as Error;
          const errorMsg =
            error.message || "Failed to send message. Please try again.";

          setMessages((prev) =>
            prev.map((m) =>
              m.id === failedMessage.id
                ? {
                    ...m,
                    localStatus: "failed",
                    errorMessage: errorMsg,
                    lastAttemptAt: new Date().toISOString(),
                  }
                : m
            )
          );

          setMessages((prev) => prev.filter((m) => m.id !== typingId));

          // Show specific error message
          if (retryCount + 1 >= maxRetries) {
            antdMessage.error(
              `Failed after ${maxRetries} attempts. Please check your connection.`
            );
          } else {
            antdMessage.error(
              `Retry ${retryCount + 1} failed. ${
                maxRetries - retryCount - 1
              } attempts remaining.`
            );
          }

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        }
      );
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg =
        error.message || "Network error. Please check your connection.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMessage.id
            ? {
                ...m,
                localStatus: "failed",
                errorMessage: errorMsg,
                lastAttemptAt: new Date().toISOString(),
              }
            : m
        )
      );

      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      if (retryCount + 1 >= maxRetries) {
        antdMessage.error(
          `Failed after ${maxRetries} attempts. Please try again later.`
        );
      } else {
        antdMessage.error(`Retry ${retryCount + 1} failed. You can try again.`);
      }

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

  /**
   * Handle requesting follow-up suggestions for a message
   */
  const handleRequestFollowups = (messageId: string, content: string) => {
    if (!isConnected) {
      antdMessage.warning("Not connected to server");
      return;
    }

    if (!user?.id) {
      antdMessage.warning("User not authenticated");
      return;
    }

    // Find the bot message and the last user message before it
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      // logging removed: message not found
      return;
    }

    const lastBotMessage = content;
    let lastUserMessage = "";

    // Find the most recent user message before this bot message
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i].content;
        break;
      }
    }

    // Validate that we have both messages
    if (!lastUserMessage || lastUserMessage.trim().length === 0) {
      // logging removed: no user message before bot message
      antdMessage.warning(
        "Cannot generate suggestions: conversation context not found"
      );
      return;
    }

    if (!lastBotMessage || lastBotMessage.trim().length === 0) {
      // logging removed: bot message is empty
      antdMessage.warning(
        "Cannot generate suggestions: message content is empty"
      );
      return;
    }

    // logging removed: requesting suggestions with context

    // Mark message as loading suggestions
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isLoadingFollowups: true } : msg
      )
    );

    // Request suggestions via websocket with both messages and sessionId for multi-tab sync
    const sessionId = String(user.id);
    websocketService.requestFollowups(
      messageId,
      lastUserMessage,
      lastBotMessage,
      sessionId
    );
  };

  /**
   * Handle requesting conversation-based follow-up suggestions (for input lightbulb)
   */
  const handleRequestConversationSuggestions = () => {
    if (!isConnected) {
      antdMessage.warning("Not connected to server");
      return;
    }

    if (!user?.id) {
      antdMessage.warning("User not authenticated");
      return;
    }

    if (!currentConversation) {
      antdMessage.warning("No active conversation");
      return;
    }

    // Get up to 10 recent messages
    const recentMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    if (recentMessages.length === 0) {
      antdMessage.info("Start a conversation to get suggestions");
      return;
    }

    setIsLoadingConversationSuggestions(true);
    setConversationSuggestions([]);

    // Request suggestions via websocket
    const sessionId = String(user.id);
    websocketService.requestConversationFollowups(
      currentConversation.id,
      recentMessages,
      sessionId
    );
  };

  /**
   * Handle clicking a follow-up suggestion
   */
  const handleFollowupClick = (suggestion: string) => {
    if (!currentConversation) return;
    handleSendMessage(suggestion);
  };

  // Listen for follow-up response events
  useEffect(() => {
    const handleFollowupsResponse = (event: CustomEvent) => {
      const { messageId, suggestions } = event.detail;
      // logging removed: received suggestions

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                followupSuggestions: suggestions,
                isLoadingFollowups: false,
              }
            : msg
        )
      );
    };

    const handleFollowupsError = (event: CustomEvent) => {
      const { messageId, error } = event.detail;
      // logging removed: followups error

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isLoadingFollowups: false } : msg
        )
      );

      // Show user-friendly error message
      const errorMsg =
        typeof error === "string"
          ? error
          : "Unable to generate suggestions. Please try again.";
      antdMessage.error(errorMsg);
    };

    window.addEventListener(
      "followups_response",
      handleFollowupsResponse as EventListener
    );
    window.addEventListener(
      "followups_error",
      handleFollowupsError as EventListener
    );

    return () => {
      window.removeEventListener(
        "followups_response",
        handleFollowupsResponse as EventListener
      );
      window.removeEventListener(
        "followups_error",
        handleFollowupsError as EventListener
      );
    };
  }, [antdMessage]);

  // Set up websocket handlers for follow-ups
  useEffect(() => {
    websocketService.setHandlers({
      onFollowupsResponse: (data) => {
        window.dispatchEvent(
          new CustomEvent("followups_response", { detail: data })
        );
      },
      onFollowupsError: (data) => {
        window.dispatchEvent(
          new CustomEvent("followups_error", { detail: data })
        );
      },
    });

    // Listen for conversation followup responses
    const handleConversationFollowupsResponse = (event: CustomEvent) => {
      const { conversationId, suggestions } = event.detail;
      if (conversationId === currentConversation?.id) {
        setConversationSuggestions(suggestions);
        setIsLoadingConversationSuggestions(false);
      }
    };

    const handleConversationFollowupsError = (event: CustomEvent) => {
      const { conversationId, error } = event.detail;
      if (conversationId === currentConversation?.id) {
        setIsLoadingConversationSuggestions(false);
        const errorMsg =
          typeof error === "string"
            ? error
            : "Unable to generate suggestions. Please try again.";
        antdMessage.error(errorMsg);
      }
    };

    window.addEventListener(
      "conversation_followups_response",
      handleConversationFollowupsResponse as EventListener
    );
    window.addEventListener(
      "conversation_followups_error",
      handleConversationFollowupsError as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation_followups_response",
        handleConversationFollowupsResponse as EventListener
      );
      window.removeEventListener(
        "conversation_followups_error",
        handleConversationFollowupsError as EventListener
      );
    };
  }, [currentConversation?.id, antdMessage]);

  /**
   * Handle pin toggle from MessageBubble
   */
  const handlePinToggle = (messageId: string, isPinned: boolean) => {
    // Update local state
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, pinned: isPinned } : msg
      )
    );

    // Trigger dropdown refresh
    setPinnedRefreshTrigger((prev) => prev + 1);
  };

  // Listen for pin/unpin events from websocket (real-time sync)
  useEffect(() => {
    const handleMessagePinned = (event: CustomEvent) => {
      const { conversationId: eventConvId, messageId, message } = event.detail;

      // Only update if it's for the current conversation
      if (eventConvId === currentConversation?.id) {
        setMessages((prev) => {
          // If message is provided, update it; otherwise just set pinned flag
          if (message) {
            const exists = prev.some((msg) => msg.id === messageId);
            if (exists) {
              return prev.map((msg) =>
                msg.id === messageId ? { ...msg, pinned: true } : msg
              );
            }
            // Message not in list, optionally add it
            return prev;
          } else {
            return prev.map((msg) =>
              msg.id === messageId ? { ...msg, pinned: true } : msg
            );
          }
        });

        // Trigger dropdown refresh
        setPinnedRefreshTrigger((prev) => prev + 1);
      }
    };

    const handleMessageUnpinned = (event: CustomEvent) => {
      const { conversationId: eventConvId, messageId } = event.detail;

      // Only update if it's for the current conversation
      if (eventConvId === currentConversation?.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, pinned: false } : msg
          )
        );

        // Trigger dropdown refresh
        setPinnedRefreshTrigger((prev) => prev + 1);
      }
    };

    window.addEventListener(
      "message:pinned",
      handleMessagePinned as EventListener
    );
    window.addEventListener(
      "message:unpinned",
      handleMessageUnpinned as EventListener
    );

    return () => {
      window.removeEventListener(
        "message:pinned",
        handleMessagePinned as EventListener
      );
      window.removeEventListener(
        "message:unpinned",
        handleMessageUnpinned as EventListener
      );
    };
  }, [currentConversation?.id]);

  return (
    <Layout className={styles.chatPageLayout}>
      <Layout className={styles.mainLayout}>
        {/* Sidebar component */}
        <Sidebar
          currentConversationId={currentConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onHighlightMessage={handleSearchResultClick}
          unreadConversations={unreadConversations}
          onSettingsClick={() => setSettingsModalOpen(true)}
          onProfileClick={() => setProfileModalOpen(true)}
        />

        {/* Main content area */}
        <Content className={styles.contentArea}>
          {/* Main content */}

          {/* Always show chat interface (either empty or with messages) */}
          {!currentConversation ? (
            <>
              {/* Empty conversation - show placeholder and input */}
              <div className={styles.conversationHeader}>
                <div className={styles.conversationHeaderLeft}>
                  <Title level={4} className={styles.conversationTitle}>
                    New Chat
                  </Title>
                  <NetworkStatus position="inline" />
                </div>
              </div>

              {/* Empty message list with placeholder */}
              <MessageList
                messages={[]}
                isLoading={false}
                showScrollButton={false}
                messageRefs={messageRefs}
                highlightedMessageId={highlightedMessageId}
                onRequestFollowups={handleRequestFollowups}
                onFollowupClick={handleFollowupClick}
                onPinToggle={handlePinToggle}
              />

              {/* Chat input for new conversation */}
              <ChatInput
                onSendMessage={handleSendMessage}
                conversationId={undefined}
                disabled={isSendingMessage}
                placeholder="Type your message to start a new conversation..."
                onTypingStart={() => isConnected && startTyping()}
                onTypingStop={() => isConnected && stopTyping()}
                onRequestSuggestions={handleRequestConversationSuggestions}
                suggestions={conversationSuggestions}
                isLoadingSuggestions={isLoadingConversationSuggestions}
              />
            </>
          ) : (
            <>
              {/* Conversation header */}
              <div className={styles.conversationHeader}>
                <div className={styles.conversationHeaderLeft}>
                  <div className={styles.conversationTitleContainer}>
                    <Title level={4} className={styles.conversationTitle}>
                      {currentConversation.title}
                    </Title>
                  </div>
                  <NetworkStatus position="inline" />
                </div>

                {/* Semantic Search within conversation */}
                <div className={styles.conversationSearchContainer}>
                  <ConversationSearch
                    conversationId={currentConversation.id}
                    onResultClick={handleSearchResultClick}
                  />
                  {/* Pinned Messages Dropdown */}
                  <PinnedMessagesDropdown
                    conversationId={currentConversation.id}
                    onMessageClick={handleSearchResultClick}
                    refreshTrigger={pinnedRefreshTrigger}
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
                onRequestFollowups={handleRequestFollowups}
                onFollowupClick={handleFollowupClick}
                onPinToggle={handlePinToggle}
              />

              {/* Chat input - disable while AI is typing to mirror sender tab behaviour */}
              <ChatInput
                onSendMessage={handleSendMessage}
                conversationId={currentConversation.id}
                disabled={
                  isAITyping || isSendingMessage || isSendingRealtimeMessage
                }
                placeholder="Type your message here..."
                onTypingStart={() => isConnected && startTyping()}
                onTypingStop={() => isConnected && stopTyping()}
                onRequestSuggestions={handleRequestConversationSuggestions}
                suggestions={conversationSuggestions}
                isLoadingSuggestions={isLoadingConversationSuggestions}
              />
            </>
          )}
        </Content>
      </Layout>

      {/* New Conversation Modal - Deprecated: now using inline draft mode */}
      {/* 
      <ConversationForm
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onSubmit={handleCreateSubmit}
        loading={isCreating}
      />
      */}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onCancel={() => setSettingsModalOpen(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
      />
    </Layout>
  );
};

export default ChatPage;
