/**
 * SettingsModal Component
 * Modal for managing user AI assistant preferences
 */

import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  Typography,
  Space,
  Divider,
  App,
  Alert,
} from "antd";
import {
  SettingOutlined,
  GlobalOutlined,
  FontSizeOutlined,
  EditOutlined,
} from "@ant-design/icons";
import {
  getUserPreferences,
  updateUserPreferences,
  LANGUAGE_OPTIONS,
  RESPONSE_STYLE_OPTIONS,
  type UpdateUserPreferencesInput,
} from "../services/user-preference.service";
import type { AxiosError } from "axios";
import styles from "./SettingsModal.module.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

interface SettingsModalProps {
  open: boolean;
  onCancel: () => void;
}

/**
 * SettingsModal component
 * Allows users to configure their AI assistant preferences in a modal dialog
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ open, onCancel }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");

  /**
   * Load user preferences when modal opens
   */
  useEffect(() => {
    if (open) {
      loadPreferences();
    }
  }, [open]);

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
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      setError("");

      // Prepare data for API
      const updateData: UpdateUserPreferencesInput = {
        language: values.language,
        response_style: values.response_style,
        custom_instructions: values.custom_instructions || null,
      };

      const response = await updateUserPreferences(updateData);

      if (response.success) {
        const msg = response.message || "Preferences saved successfully!";
        message.success(msg);
        onCancel(); // Close modal on success
      }
    } catch (err: any) {
      // Handle validation errors
      if (err.errorFields) {
        return; // Form validation errors, don't show message
      }

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

  /**
   * Handle modal cancel
   */
  const handleCancel = () => {
    setError("");
    onCancel();
  };

  return (
    <Modal
      title={
        <Space size={12}>
          <SettingOutlined style={{ fontSize: 20 }} />
          <span>AI Assistant Settings</span>
        </Space>
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="Save Preferences"
      cancelText="Cancel"
      confirmLoading={isSaving}
      width={720}
      centered
      className={styles.settingsModal}
      destroyOnClose
    >
      <div className={styles.modalDescription}>
        <Text>✨ Customize how your AI assistant responds to you</Text>
      </div>

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

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          language: "en",
          response_style: "balanced",
          custom_instructions: "",
        }}
        className={styles.settingsForm}
      >
        {/* Language Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <GlobalOutlined className={styles.sectionIcon} />
            <Title level={5} className={styles.sectionTitle}>
              Language Preference
            </Title>
          </div>
          <Form.Item
            name="language"
            help="🌍 Choose the language for AI responses"
            rules={[{ required: true, message: "Please select a language" }]}
          >
            <Select
              size="large"
              placeholder="Select your preferred language"
              options={LANGUAGE_OPTIONS}
              disabled={isLoading || isSaving}
              loading={isLoading}
            />
          </Form.Item>
        </div>

        {/* Response Style Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FontSizeOutlined className={styles.sectionIcon} />
            <Title level={5} className={styles.sectionTitle}>
              Response Style
            </Title>
          </div>
          <Form.Item
            name="response_style"
            help="📝 How should the AI format its responses?"
            rules={[
              { required: true, message: "Please select a response style" },
            ]}
          >
            <Select
              size="large"
              placeholder="Select response style"
              disabled={isLoading || isSaving}
              loading={isLoading}
            >
              {RESPONSE_STYLE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  <div className={styles.styleOption}>
                    <strong>{option.label}</strong>
                    <span className={styles.styleDescription}>
                      {option.description}
                    </span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        {/* Custom Instructions Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <EditOutlined className={styles.sectionIcon} />
            <Title level={5} className={styles.sectionTitle}>
              Custom Instructions
            </Title>
          </div>
          <Form.Item
            name="custom_instructions"
            help="✏️ Add specific instructions for the AI (optional, max 2000 characters)"
            rules={[
              {
                max: 2000,
                message: "Custom instructions cannot exceed 2000 characters",
              },
            ]}
          >
            <TextArea
              placeholder="Example: Always include code examples when explaining programming concepts, or respond with enthusiasm and emojis"
              rows={4}
              maxLength={2000}
              showCount
              disabled={isLoading || isSaving}
            />
          </Form.Item>

          <div className={styles.hint}>
            💡 <strong>Tip:</strong> Custom instructions will be added to every
            conversation to guide the AI's behavior. Be clear and specific for
            best results.
          </div>
        </div>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
