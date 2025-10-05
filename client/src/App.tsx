/**
 * Main App Component
 * Configures routing and authentication
 */

import React from "react";
import { Routes, Route } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { AuthProvider } from "./hooks";
import { ProtectedRoute } from "./components";
import { HomePage, LoginPage, RegisterPage, NotFoundPage } from "./pages";

const App: React.FC = () => {
  return (
    // Configure Ant Design with light theme
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // Light theme
        token: {
          colorPrimary: "#1890ff", // Primary color
          borderRadius: 6,
        },
      }}
    >
      {/* Provide authentication context to entire app */}
      <AuthProvider>
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
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* 404 Not Found route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
