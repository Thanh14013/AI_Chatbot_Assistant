/**
 * Register Page Component
 * User registration page with form validation
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message, Alert } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../hooks";
import type { RegisterRequest } from "../types";
import type { AxiosError } from "axios";
import styles from "./RegisterPage.module.css";

const { Title, Text } = Typography;

/**
 * RegisterPage component
 * Renders registration form with validation
 */
const RegisterPage: React.FC = () => {
  const { register, isLoading } = useAuth();
  const [error, setError] = useState<string>("");

  /**
   * Handle form submission
   * Validates and sends registration data to API
   */
  const handleSubmit = async (values: RegisterRequest) => {
    try {
      // Clear any previous errors
      setError("");

      // Attempt to register
      await register(values);

      // Show success message
      message.success("Registration successful! Please login.");
    } catch (err) {
      // Handle registration errors
      const axiosError = err as AxiosError<{ message: string }>;
      const errorMessage =
        axiosError.response?.data?.message ||
        "Registration failed. Please try again.";

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
            Create Account
          </Title>
          <Text type="secondary">Join us to get started</Text>
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

        {/* Registration Form */}
        <Form
          name="register"
          onFinish={handleSubmit}
          autoComplete="off"
          layout="vertical"
          requiredMark={false}
        >
          {/* Name Field */}
          <Form.Item
            name="name"
            label="Full Name"
            rules={[
              { required: true, message: "Please input your name!" },
              { min: 2, message: "Name must be at least 2 characters!" },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your full name"
              size="large"
              disabled={isLoading}
            />
          </Form.Item>

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
              prefix={<MailOutlined />}
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

          {/* Confirm Password Field */}
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password!" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("The two passwords do not match!")
                  );
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm your password"
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
              {isLoading ? "Creating account..." : "Register"}
            </Button>
          </Form.Item>

          {/* Login Link */}
          <div className={styles.footer}>
            <Text type="secondary">
              Already have an account?{" "}
              <Link to="/login" className={styles.link}>
                Login here
              </Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
