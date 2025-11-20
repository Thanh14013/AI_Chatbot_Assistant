/**
 * Register Page Component
 * User registration page with form validation
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, App, Alert } from "antd";
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
  const { message } = App.useApp();
  const { register, isLoading } = useAuth();
  const [error, setError] = useState<string>("");

  // Controlled fields
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // Validation patterns
  const nameRe = /^[A-Za-z\p{L}\s'\-]{2,50}$/u; // allow unicode letters, spaces, apostrophes, hyphens
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Password: min 8 chars, at least 1 upper, 1 lower, 1 digit, 1 special
  const passwordRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

  /**
   * Handle form submission
   * Validates early and sends registration data to API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const errors: string[] = [];

    // Name checks
    if (!name || name.trim().length === 0) {
      errors.push("Name: required");
    } else if (!nameRe.test(name.trim())) {
      errors.push(
        "Name: invalid format (only letters, spaces, apostrophes, hyphens; 2-50 characters)"
      );
    }

    // Email checks
    if (!email || email.trim().length === 0) {
      errors.push("Email: required");
    } else if (!emailRe.test(email)) {
      errors.push("Email: invalid format (example: yourname@example.com)");
    }

    // Password checks
    if (!password) {
      errors.push("Password: required");
    } else {
      if (password.length < 8) {
        errors.push("Password: must be at least 8 characters");
      }
      if (!/[A-Z]/.test(password)) {
        errors.push("Password: must include at least one uppercase letter");
      }
      if (!/[a-z]/.test(password)) {
        errors.push("Password: must include at least one lowercase letter");
      }
      if (!/\d/.test(password)) {
        errors.push("Password: must include at least one number");
      }
      if (!/[^A-Za-z\d]/.test(password)) {
        errors.push("Password: must include at least one special character");
      }
      // Optional combined regex check
      if (!passwordRe.test(password)) {
        // no-op; individual messages above give more detail
      }
    }

    // Confirm password
    if (password !== confirmPassword) {
      errors.push("Confirm Password: does not match password");
    }

    if (errors.length > 0) {
      const combined = errors.join(". ");
      setError(errors[0]);
      // Show a clear toast with each failing field/requirement
      message.error(combined, 6);
      return;
    }

    try {
      const resp = await register({ name, email, password } as RegisterRequest);
      const successMessage =
        (resp && (resp as any).message) ||
        "Registration successful! Please login.";
      message.success(successMessage);
    } catch (err) {
      const axiosError = err as AxiosError<{
        message: string;
        success: boolean;
      }>;

      // Extract specific error message from server response
      let errorMessage = "Registration failed. Please try again.";

      if (axiosError.response?.data?.message) {
        // Use the exact error message from server
        errorMessage = axiosError.response.data.message;
      } else if (axiosError.message) {
        // Fallback to axios error message
        errorMessage = axiosError.message;
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
          onSubmitCapture={handleSubmit}
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
              {
                pattern: nameRe,
                message:
                  "Name may only contain letters, spaces, apostrophes and hyphens (2-50 characters)",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your full name"
              size="large"
              disabled={isLoading}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
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
              () => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  if (!passwordRe.test(value)) {
                    return Promise.reject(
                      new Error(
                        "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character"
                      )
                    );
                  }
                  return Promise.resolve();
                },
              }),
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
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
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
