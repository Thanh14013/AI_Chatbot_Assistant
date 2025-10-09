/**
 * ChatPage Component
 * Main chat interface with sidebar and message area
 */

import React, { useState, useEffect } from "react";
import {
  Layout,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  message as antdMessage,
} from "antd";
import { createConversation as apiCreateConversation } from "../services/chat.service";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import EmptyState from "../components/EmptyState";
import { useChat } from "../hooks";
import {
  Conversation,
  ConversationListItem,
  Message,
} from "../types/chat.type";
import styles from "./ChatPage.module.css";

const { Content } = Layout;
const { Title } = Typography;

/**
 * ChatPage component
 * Main layout for chat interface with sidebar and message area
 */
const ChatPage: React.FC = () => {
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPage, setMessagesPage] = useState<number>(1);
  const [messagesHasMore, setMessagesHasMore] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  // Sidebar is rendered by the new Sidebar component

  // Modal/form state for creating conversation
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const params = useParams();

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
        // prepend older messages
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
   * Handle creating a new conversation
   */
  const openNewConversationModal = () => {
    setIsModalVisible(true);
  };

  const handleNewConversation = () => {
    openNewConversationModal();
  };

  const handleCreateSubmit = async (values: any) => {
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
      form.resetFields();

      // Navigate to conversation URL
      navigate(`/conversations/${conversation.id}`);

      // Refresh conversations list so the new one shows up
      await refreshConversations();

      // Set current conversation and clear messages placeholder
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
  useEffect(() => {
    const id = params.id;
    if (!id) return;
    const loadConversation = async (convId: string) => {
      setIsLoadingMessages(true);
      try {
        const svc = await import("../services/chat.service");
        const conv = await svc.getConversation(convId);
        setCurrentConversation(conv as any);
        const result = await svc.getMessages(convId, 1, 20);
        setMessages(result.messages);
        setMessagesPage(result.pagination.page);
        setMessagesHasMore(
          result.pagination.page < result.pagination.totalPages
        );
      } catch (err) {
        antdMessage.error("Failed to load conversation");
        setCurrentConversation(null);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadConversation(id);
  }, [params.id]);

  /**
   * Handle sending a message
   */
  const handleSendMessage = (content: string) => {
    // Prevent sending if already sending or no conversation selected
    if (isSendingMessage || !currentConversation) return;

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

              // replace temp user message with server user message if provided
              const replaced = withoutTyping.map((m) =>
                m.id === tempId && userMsg ? userMsg : m
              );

              // append assistant message from server (final)
              if (assistantMsg) return [...replaced, assistantMsg];
              return replaced;
            });

            // refresh conversation metadata if present
            if ((result as any)?.conversation) {
              setCurrentConversation((prev) =>
                prev
                  ? {
                      ...prev,
                      total_tokens_used: (result as any).conversation
                        .total_tokens_used,
                      message_count: (result as any).conversation.message_count,
                    }
                  : prev
              );

              // Optimistically move conversation to top and update metadata
              const conv = (result as any).conversation;
              moveConversationToTop(currentConversation.id);
              updateConversationOptimistic(currentConversation.id, {
                message_count: conv.message_count,
                updatedAt: new Date().toISOString(),
              });

              // Background fetch to sync with server (fire and forget for smooth UX)
              refreshConversations().catch(() => {});
            }
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

            // Background sync
            refreshConversations().catch(() => {});
          }
        },
        (err) => {
          antdMessage.error("Retry failed");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === failedMessage.id ? { ...m, localStatus: "failed" } : m
            )
          );
        }
      );
    } catch (err) {
      antdMessage.error("Retry failed");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMessage.id ? { ...m, localStatus: "failed" } : m
        )
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <Layout className={styles.chatPageLayout}>
      <Layout className={styles.mainLayout}>
        {/* Sidebar component */}
        <Sidebar
          conversations={conversations as any}
          currentConversation={currentConversation as any}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          isLoading={isLoadingConversations}
          loadMore={loadMoreConversations}
          hasMore={conversationsHasMore}
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
                <Title level={4} className={styles.conversationTitle}>
                  {currentConversation.title}
                </Title>
              </div>

              {/* Messages list */}
              <MessageList
                messages={messages}
                isLoading={isSendingMessage}
                showScrollButton
                onLoadEarlier={loadEarlier}
                hasMore={messagesHasMore}
                onRetry={handleRetryMessage}
              />

              {/* Chat input */}
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isSendingMessage}
                placeholder="Type your message here..."
              />
            </>
          )}
        </Content>
      </Layout>

      {/* New Conversation Modal */}
      <Modal
        title="Create New Conversation"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{ model: "gpt-5-nano", context_window: 10 }}
        >
          <Form.Item
            label="Conversation Title"
            name="title"
            rules={[{ required: true, message: "Please enter a title" }]}
          >
            <Input placeholder="E.g. Project brainstorming" />
          </Form.Item>

          <Form.Item label="Model" name="model">
            <Select>
              <Select.Option value="gpt-5-nano">gpt-5-nano</Select.Option>
              <Select.Option value="gpt-4">gpt-4</Select.Option>
              <Select.Option value="gpt-3.5-turbo">gpt-3.5-turbo</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Context Window" name="context_window">
            <Select>
              <Select.Option value={5}>5</Select.Option>
              <Select.Option value={10}>10</Select.Option>
              <Select.Option value={20}>20</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <div className={styles.modalFooter}>
              <Button
                onClick={() => setIsModalVisible(false)}
                className={styles.modalCancel}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={isCreating}>
                Create
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default ChatPage;
