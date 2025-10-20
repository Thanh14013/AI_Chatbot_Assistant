/**
 * Main App Component
 * Configures routing and authentication
 */

import React from "react";
import { Routes, Route } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import { AuthProvider } from "./hooks";
import { PreferencesProvider } from "./stores/preferences.store";
import { ProtectedRoute } from "./components";
import ErrorBoundary from "./components/ErrorBoundary";
import { ChatPage, LoginPage, RegisterPage, NotFoundPage } from "./pages";

const App: React.FC = () => {
  return (
    // Configure Ant Design with light theme
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff", // Primary color
          borderRadius: 6,
        },
      }}
    >
      {/* Ant Design App component for message context */}
      <AntApp>
        {/* Provide authentication context to entire app */}
        <ErrorBoundary>
          <AuthProvider>
            {/* Provide preferences context */}
            <PreferencesProvider>
              {/* Configure application routes */}
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Protected routes - require authentication */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  }
                />
                {/* Conversation-specific route */}
                <Route
                  path="/conversations/:id"
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Not Found route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </PreferencesProvider>
          </AuthProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
