/**
 * Login Page Component
 * User authentication page with form validation
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message, Alert } from "antd";
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
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string>("");

  /**
   * Handle form submission
   * Validates and sends login credentials to API
   */
  const handleSubmit = async (values: LoginRequest) => {
    try {
      // Clear any previous errors
      setError("");

      // Attempt to login
      await login(values);

      // Show success message
      message.success("Login successful! Redirecting...");
    } catch (err) {
      // Handle login errors
      const axiosError = err as AxiosError<{ message: string }>;
      const errorMessage =
        axiosError.response?.data?.message || "Login failed. Please try again.";

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
          onFinish={handleSubmit}
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
