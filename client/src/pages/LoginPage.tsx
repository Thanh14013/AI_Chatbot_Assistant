/**
 * Login Page Component
 * User authentication page with form validation
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, App, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../hooks";
import type { LoginRequest } from "../types";
import type { AxiosError } from "axios";
import styles from "./LoginPage.module.css";

const { Title, Text } = Typography;

/**
 * LoginPage component
 * Renders login form with email and password fields
 */
const LoginPage: React.FC = () => {
  const { message } = App.useApp();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string>("");

  // Controlled form fields
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  /**
   * Handle form submission
   * Validates early and sends login credentials to API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent browser from reloading the page
    e.preventDefault();

    // Clear previous errors
    setError("");

    // Early client-side validation
    if (!email || !email.trim()) {
      const msg = "Please enter your email.";
      setError(msg);
      message.error(msg);
      return;
    }
    // Basic email format check
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      const msg = "Please enter a valid email address.";
      setError(msg);
      message.error(msg);
      return;
    }

    if (!password || password.length < 6) {
      const msg = "Password must be at least 6 characters.";
      setError(msg);
      message.error(msg);
      return;
    }

    try {
      // Attempt to login
      const resp = await login({ email, password } as LoginRequest);

      // If backend returns a message, prefer it
      const successMessage =
        (resp && (resp as any).message) || "Login successful! Redirecting...";
      message.success(successMessage);
    } catch (err) {
      // Handle login errors robustly and show server-provided message when available
      const axiosError = err as AxiosError<any>;
      let errorMessage = "Login failed. Please try again.";

      if (axiosError?.response) {
        const respData = axiosError.response.data;
        if (respData?.message && typeof respData.message === "string") {
          errorMessage = respData.message;
        } else if (respData?.error && typeof respData.error === "string") {
          errorMessage = respData.error;
        } else if (typeof respData === "string") {
          errorMessage = respData;
        } else if (axiosError.response.status === 401) {
          errorMessage = "Account or password is incorrect";
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      message.error(errorMessage);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        {/* Title */}
        <div className={styles.header}>
          <Title level={2} className={styles.title}>
            Welcome Back
          </Title>
          <Text type="secondary">Please login to your account</Text>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            message={error}
            type="error"
            closable
            onClose={() => setError("")}
            className={styles.alert}
          />
        )}

        {/* Login Form */}
        <Form
          name="login"
          onSubmitCapture={handleSubmit}
          autoComplete="off"
          layout="vertical"
          requiredMark={false}
        >
          {/* Email Field */}
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please input your email!" },
              { type: "email", message: "Please enter a valid email!" },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your email"
              size="large"
              disabled={isLoading}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </Form.Item>

          {/* Password Field */}
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Please input your password!" },
              { min: 6, message: "Password must be at least 6 characters!" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              size="large"
              disabled={isLoading}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </Form.Item>

          {/* Submit Button */}
          <Form.Item className={styles.submitButton}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </Form.Item>

          {/* Register Link */}
          <div className={styles.footer}>
            <Text type="secondary">
              Don't have an account?{" "}
              <Link to="/register" className={styles.link}>
                Register now
              </Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
