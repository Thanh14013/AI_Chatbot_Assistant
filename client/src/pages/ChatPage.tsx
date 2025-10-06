/**
 * ChatPage Component
 * Main chat interface with sidebar and message area
 */

import React, { useState, useEffect } from "react";
import { Layout, Button, Typography, Drawer } from "antd";
import { PlusOutlined, MenuOutlined, CloseOutlined } from "@ant-design/icons";
import { NavigationHeader } from "../components";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import ConversationItem from "../components/ConversationItem";
import EmptyState from "../components/EmptyState";
import {
  Conversation,
  ConversationListItem,
  Message,
  MessageRole,
} from "../types/chat.type";
import styles from "./ChatPage.module.css";

const { Sider, Content } = Layout;
const { Title } = Typography;

/**
 * ChatPage component
 * Main layout for chat interface with sidebar and message area
 */
const ChatPage: React.FC = () => {
  // State management
  // Sidebar list uses minimal ConversationListItem returned by the server
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // On mount, fetch conversation list from API
  useEffect(() => {
    // TODO: replace with API call: chatService.getConversations()
    setIsLoadingConversations(true);
    setConversations([]); // start empty until backend integration
    setIsLoadingConversations(false);
  }, []);

  // Load messages for a conversation from server
  // TODO: replace with API call: chatService.getMessages(conversationId)
  const loadMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    setMessages([]);
    setIsLoadingMessages(false);
  };

  /**
   * Handle creating a new conversation
   */
  const handleNewConversation = () => {
    // TODO: call API to create conversation: chatService.createConversation()
    // For now just clear selection and prepare for a new conversation
    setCurrentConversation(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  /**
   * Handle selecting a conversation
   */
  const handleSelectConversation = (conversationId: string) => {
    // TODO: fetch conversation details and messages from server
    setIsLoadingMessages(true);
    setCurrentConversation(null);
    setMessages([]);
    setIsSidebarOpen(false);
    setIsLoadingMessages(false);
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = (content: string) => {
    // Prevent sending if already sending or no conversation selected
    if (isSendingMessage || !currentConversation) return;
    // Send message to server via API
    // TODO: call chatService.sendMessage({ conversation_id: currentConversation.id, content })
    setIsSendingMessage(true);
    try {
      // no local mock messages added
    } finally {
      setIsSendingMessage(false);
    }
  };

  /**
   * Toggle sidebar on mobile
   */
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  /**
   * Render sidebar content
   */
  const renderSidebarContent = () => (
    <div className={styles.sidebar}>
      {/* New conversation button */}
      <div className={styles.sidebarHeader}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          block
          size="large"
          className={styles.newConversationBtn}
        >
          New Conversation
        </Button>
      </div>

      {/* Conversations list */}
      <div className={styles.conversationsList}>
        <Title level={5} className={styles.conversationsTitle}>
          Recent Conversations
        </Title>

        {isLoadingConversations ? (
          <div className={styles.loadingContainer}>Loading...</div>
        ) : conversations.length === 0 ? (
          <EmptyState
            type="conversations"
            onAction={handleNewConversation}
            actionText="Start Chatting"
          />
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={currentConversation?.id === conversation.id}
              onClick={handleSelectConversation}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <Layout className={styles.chatPageLayout}>
      {/* Navigation header */}
      <NavigationHeader />

      <Layout className={styles.mainLayout}>
        {/* Desktop sidebar */}
        <Sider width={320} className={styles.siderDesktop}>
          {renderSidebarContent()}
        </Sider>

        {/* Mobile sidebar drawer */}
        <Drawer
          title="Conversations"
          placement="left"
          onClose={() => setIsSidebarOpen(false)}
          open={isSidebarOpen}
          width={300}
          className={styles.siderMobile}
        >
          {renderSidebarContent()}
        </Drawer>

        {/* Main content area */}
        <Content className={styles.contentArea}>
          {/* Mobile menu button */}
          <Button
            type="text"
            icon={isSidebarOpen ? <CloseOutlined /> : <MenuOutlined />}
            onClick={toggleSidebar}
            className={styles.mobileMenuBtn}
            size="large"
          />

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
    </Layout>
  );
};

export default ChatPage;
