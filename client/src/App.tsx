/**
 * Main App Component
 * Configures routing and authentication
 */

import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ConfigProvider, App as AntApp, Spin } from "antd";
import { AuthProvider } from "./hooks";
import { PreferencesProvider } from "./stores/preferences.store";
import { ProtectedRoute } from "./components";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load pages for code splitting
const ChatPage = lazy(() => import("./pages/ChatPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Loading fallback component
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <Spin size="large" tip="Loading..." />
  </div>
);

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
              <Suspense fallback={<PageLoader />}>
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
              </Suspense>
            </PreferencesProvider>
          </AuthProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
