/**
 * Settings Page Component
 * User preferences configuration page
 */

import React, { useState, useEffect } from "react";
import {
  Form,
  Select,
  Input,
  Button,
  Card,
  Typography,
  App,
  Spin,
  Divider,
  Space,
  Alert,
} from "antd";
import { SaveOutlined, SettingOutlined } from "@ant-design/icons";
import {
  getUserPreferences,
  updateUserPreferences,
  LANGUAGE_OPTIONS,
  RESPONSE_STYLE_OPTIONS,
  type UpdateUserPreferencesInput,
} from "../services/user-preference.service";
import type { AxiosError } from "axios";
import styles from "./SettingsPage.module.css";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * SettingsPage component
 * Allows users to configure their AI assistant preferences
 */
const SettingsPage: React.FC = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  /**
   * Load user preferences on component mount
   */
  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Fetch user preferences from API
   */
  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getUserPreferences();

      if (response.success && response.data) {
        // Populate form with fetched preferences
        form.setFieldsValue({
          language: response.data.language,
          response_style: response.data.response_style,
          custom_instructions: response.data.custom_instructions || "",
        });
      }
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      let errorMessage = "Failed to load preferences";

      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (values: UpdateUserPreferencesInput) => {
    try {
      setIsSaving(true);
      setError("");
      setSuccessMessage("");

      // Prepare data for API
      const updateData: UpdateUserPreferencesInput = {
        language: values.language,
        response_style: values.response_style,
        custom_instructions: values.custom_instructions || null,
      };

      const response = await updateUserPreferences(updateData);

      if (response.success) {
        const msg = response.message || "Preferences saved successfully!";
        setSuccessMessage(msg);
        message.success(msg);

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      let errorMessage = "Failed to save preferences";

      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="Loading preferences..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <Space align="center" size="middle">
            <SettingOutlined className={styles.icon} />
            <div>
              <Title level={2} className={styles.title}>
                AI Assistant Settings
              </Title>
              <Text type="secondary">
                Customize how your AI assistant responds to you
              </Text>
            </div>
          </Space>
        </div>

        <Divider />

        {/* Success Message */}
        {successMessage && (
          <Alert
            message={successMessage}
            type="success"
            closable
            onClose={() => setSuccessMessage("")}
            className={styles.alert}
            showIcon
          />
        )}

        {/* Error Message */}
        {error && (
          <Alert
            message={error}
            type="error"
            closable
            onClose={() => setError("")}
            className={styles.alert}
            showIcon
          />
        )}

        {/* Settings Form */}
        <Form
          form={form}
          name="preferences"
          onFinish={handleSubmit}
          layout="vertical"
          autoComplete="off"
          requiredMark={false}
        >
          {/* Language Preference */}
          <Form.Item
            name="language"
            label={
              <span className={styles.label}>
                <strong>Language</strong>
                <Text type="secondary" className={styles.labelDescription}>
                  Choose the language for AI responses
                </Text>
              </span>
            }
            rules={[{ required: true, message: "Please select a language" }]}
          >
            <Select
              size="large"
              placeholder="Select language"
              options={LANGUAGE_OPTIONS}
              disabled={isSaving}
              getPopupContainer={(trigger) =>
                trigger.parentElement || document.body
              }
            />
          </Form.Item>

          {/* Response Style Preference */}
          <Form.Item
            name="response_style"
            label={
              <span className={styles.label}>
                <strong>Response Style</strong>
                <Text type="secondary" className={styles.labelDescription}>
                  How should the AI format its responses?
                </Text>
              </span>
            }
            rules={[
              { required: true, message: "Please select a response style" },
            ]}
          >
            <Select
              size="large"
              placeholder="Select response style"
              disabled={isSaving}
              getPopupContainer={(trigger) =>
                trigger.parentElement || document.body
              }
            >
              {RESPONSE_STYLE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  <div>
                    <div>{option.label}</div>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      {option.description}
                    </Text>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Custom Instructions */}
          <Form.Item
            name="custom_instructions"
            label={
              <span className={styles.label}>
                <strong>Custom Instructions</strong>
                <Text type="secondary" className={styles.labelDescription}>
                  Add specific instructions for the AI (optional)
                </Text>
              </span>
            }
            rules={[
              {
                max: 2000,
                message: "Custom instructions cannot exceed 2000 characters",
              },
            ]}
          >
            <TextArea
              placeholder="Example: Always include code examples when explaining programming concepts, or respond with enthusiasm and emojis"
              rows={6}
              maxLength={2000}
              showCount
              disabled={isSaving}
            />
          </Form.Item>

          <Paragraph type="secondary" className={styles.hint}>
            Tip: Custom instructions will be added to every conversation to
            guide the AI's behavior. Be clear and specific for best results.
          </Paragraph>

          {/* Save Button */}
          <Form.Item className={styles.submitButton}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<SaveOutlined />}
              loading={isSaving}
              block
            >
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPage;
