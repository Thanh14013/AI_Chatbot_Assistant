// Protected Route Component
// Redirects to login if user is not authenticated
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "../hooks";
import styles from "./ProtectedRoute.module.css";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

// Wrapper component to protect routes that require authentication
// Redirects to /login if user is not authenticated
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles["loading-container"]}>
        <div className={styles["loading-text"]}>Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;
