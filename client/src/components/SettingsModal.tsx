/**
 * SettingsModal Component
 * Modal for managing user AI assistant preferences
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  Typography,
  Space,
  App,
  Alert,
  Skeleton,
} from "antd";
import {
  SettingOutlined,
  GlobalOutlined,
  FontSizeOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  LANGUAGE_OPTIONS,
  RESPONSE_STYLE_OPTIONS,
  type UpdateUserPreferencesInput,
  type UserPreference,
} from "../services/user-preference.service";
import { usePreferences } from "../stores/preferences.store";
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
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  // Use preferences context
  const {
    preferences: cachedPreferences,
    fetchPreferences,
    updatePreferencesCache,
  } = usePreferences();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Store original values to detect changes
  const originalValuesRef = useRef<UserPreference | null>(null);

  // Debounce timer for save button
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load user preferences when modal opens
   */
  useEffect(() => {
    if (open) {
      loadPreferences();
    } else {
      // Reset states when modal closes
      setError("");
      setHasUnsavedChanges(false);
      originalValuesRef.current = null;
    }
  }, [open]);

  /**
   * Update form when cached preferences change
   */
  useEffect(() => {
    if (cachedPreferences && open) {
      originalValuesRef.current = cachedPreferences;
      form.setFieldsValue({
        language: cachedPreferences.language,
        response_style: cachedPreferences.response_style,
        custom_instructions: cachedPreferences.custom_instructions || "",
      });
    }
  }, [cachedPreferences, form, open]);

  /**
   * Track form changes to detect unsaved changes
   */
  const handleFormChange = () => {
    if (!originalValuesRef.current) return;

    const currentValues = form.getFieldsValue();
    const hasChanges =
      currentValues.language !== originalValuesRef.current.language ||
      currentValues.response_style !==
        originalValuesRef.current.response_style ||
      (currentValues.custom_instructions || "") !==
        (originalValuesRef.current.custom_instructions || "");

    setHasUnsavedChanges(hasChanges);
  };

  /**
   * Fetch user preferences from API
   */
  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Use context to fetch (will use cache if available)
      await fetchPreferences();

      if (cachedPreferences) {
        // Store original values for comparison
        originalValuesRef.current = cachedPreferences;

        // Populate form with fetched preferences
        form.setFieldsValue({
          language: cachedPreferences.language,
          response_style: cachedPreferences.response_style,
          custom_instructions: cachedPreferences.custom_instructions || "",
        });

        setHasUnsavedChanges(false);
      }
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      let errorMessage = "Failed to load preferences";

      if (axiosError?.response?.status === 401) {
        errorMessage = "Session expired. Please login again.";
      } else if (axiosError?.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (axiosError?.response?.data?.message) {
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
   * Handle form submission with debouncing
   */
  const handleSubmit = async () => {
    // Clear any existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce: prevent rapid clicking
    saveTimerRef.current = setTimeout(async () => {
      try {
        const values = await form.validateFields();
        setIsSaving(true);
        setError("");

        // Trim whitespace from inputs
        const updateData: UpdateUserPreferencesInput = {
          language: values.language?.trim(),
          response_style: values.response_style?.trim(),
          custom_instructions: values.custom_instructions?.trim() || null,
        };

        // Use context to update (updates cache automatically)
        await updatePreferencesCache(updateData);

        const msg = "Preferences saved successfully! ðŸŽ‰";
        message.success(msg);

        // Update original values
        if (cachedPreferences) {
          originalValuesRef.current = cachedPreferences;
        }
        setHasUnsavedChanges(false);

        // Close modal after short delay
        setTimeout(() => {
          onCancel();
        }, 500);
      } catch (err: any) {
        // Handle validation errors
        if (err.errorFields) {
          return; // Form validation errors, don't show message
        }

        const axiosError = err as AxiosError<any>;
        let errorMessage = "Failed to save preferences";

        // Parse error by status code
        if (axiosError?.response?.status === 400) {
          errorMessage =
            axiosError.response.data?.message ||
            "Invalid input. Please check your entries.";
        } else if (axiosError?.response?.status === 401) {
          errorMessage = "Session expired. Please login again.";
        } else if (axiosError?.response?.status === 500) {
          errorMessage = "Server error. Please try again later.";
        } else if (axiosError?.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        message.error(errorMessage);
      } finally {
        setIsSaving(false);
      }
    }, 300); // 300ms debounce
  };

  /**
   * Handle modal cancel with unsaved changes warning
   */
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      modal.confirm({
        title: "Unsaved Changes",
        icon: <ExclamationCircleOutlined />,
        content:
          "You have unsaved changes. Are you sure you want to close without saving?",
        okText: "Close Without Saving",
        okButtonProps: { danger: true },
        cancelText: "Keep Editing",
        onOk: () => {
          setError("");
          setHasUnsavedChanges(false);
          onCancel();
        },
      });
    } else {
      setError("");
      onCancel();
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

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
      okButtonProps={{
        disabled: !hasUnsavedChanges || isLoading,
      }}
      cancelText="Cancel"
      confirmLoading={isSaving}
      width={720}
      centered
      className={styles.settingsModal}
      destroyOnClose
      maskClosable={!hasUnsavedChanges}
    >
      <div className={styles.modalDescription}>
        <Text>âœ¨ Customize how your AI assistant responds to you</Text>
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

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className={styles.loadingSkeleton}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            language: "en",
            response_style: "balanced",
            custom_instructions: "",
          }}
          onValuesChange={handleFormChange}
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
              help="ðŸŒ Choose the language for AI responses"
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
              help="ðŸ“ How should the AI format its responses?"
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
              help="âœï¸ Add specific instructions for the AI (optional, max 2000 characters)"
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
              ðŸ’¡ <strong>Tip:</strong> Custom instructions will be added to
              every conversation to guide the AI's behavior. Be clear and
              specific for best results.
            </div>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default SettingsModal;
