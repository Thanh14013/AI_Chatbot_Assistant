/**
 * ProfileModal Component
 * Modal for managing user profile (avatar, username, bio, password)
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  App,
  Alert,
  Skeleton,
  Divider,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  CalendarOutlined,
  LockOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  removeAvatar,
  type UserProfile,
  type UpdateProfileInput,
} from "../services/user-profile.service";
import { AvatarUpload } from "./AvatarUpload";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { useAuthContext } from "../hooks/useAuthContext";
import { getCurrentUser } from "../services/auth.service";
import type { AxiosError } from "axios";
import styles from "./ProfileModal.module.css";

const { TextArea } = Input;

interface ProfileModalProps {
  open: boolean;
  onCancel: () => void;
}

/**
 * ProfileModal component
 * Allows users to manage their profile in a modal dialog
 */
const ProfileModal: React.FC<ProfileModalProps> = ({ open, onCancel }) => {
  const { message, modal } = App.useApp();
  const { setUser } = useAuthContext();
  const [form] = Form.useForm();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Avatar pending changes
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarAction, setPendingAvatarAction] = useState<
    "upload" | "remove" | null
  >(null);

  // Store original values to detect changes
  const originalValuesRef = useRef<UpdateProfileInput>({});

  /**
   * Load user profile when modal opens
   */
  useEffect(() => {
    if (open) {
      loadProfile();
    } else {
      // Reset states when modal closes
      setError("");
      setHasUnsavedChanges(false);
      originalValuesRef.current = {};
    }
  }, [open]);

  /**
   * Track form changes to detect unsaved changes
   */
  const handleFormChange = () => {
    if (!originalValuesRef.current) return;

    const currentValues = form.getFieldsValue();
    const hasChanges =
      currentValues.username !== originalValuesRef.current.username ||
      (currentValues.bio || "") !== (originalValuesRef.current.bio || "") ||
      pendingAvatarAction !== null;

    setHasUnsavedChanges(hasChanges);
  };

  /**
   * Fetch user profile from API
   */
  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getUserProfile();

      if (response.success && response.data) {
        setProfile(response.data);

        // Store original values for comparison
        // Fallback username to name if not set
        const formValues = {
          username: response.data.username || response.data.name || "",
          bio: response.data.bio || "",
        };
        originalValuesRef.current = formValues;

        // Populate form
        form.setFieldsValue(formValues);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      let errorMessage = "Failed to load profile";

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
   * Handle avatar file selection (upload happens on save)
   */
  const handleAvatarFileSelect = (
    file: File | null,
    action: "upload" | "remove"
  ) => {
    setPendingAvatarFile(file);
    setPendingAvatarAction(action);
    setHasUnsavedChanges(true);
  };

  /**
   * Handle form submission (save all changes including avatar)
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      setError("");

      // Step 1: Handle avatar changes first (if any)
      if (pendingAvatarAction === "upload" && pendingAvatarFile) {
        const avatarResponse = await uploadAvatar(pendingAvatarFile);
        if (!avatarResponse.success) {
          throw new Error("Failed to upload avatar");
        }
        message.success("Avatar uploaded successfully!");
      } else if (pendingAvatarAction === "remove") {
        await removeAvatar();
        message.success("Avatar removed successfully!");
      }

      // Step 2: Update profile data (username, bio)
      const updateData: UpdateProfileInput = {
        username: values.username?.trim() || null,
        bio: values.bio?.trim() || null,
      };

      const response = await updateUserProfile(updateData);

      if (response.success && response.data) {
        setProfile(response.data);

        // Update original values
        const formValues = {
          username: response.data.username || "",
          bio: response.data.bio || "",
        };
        originalValuesRef.current = formValues;
        setHasUnsavedChanges(false);

        // Reset avatar pending states
        setPendingAvatarFile(null);
        setPendingAvatarAction(null);

        message.success("Profile updated successfully! ðŸŽ‰");

        // Step 3: Reload global user state
        try {
          const userResponse = await getCurrentUser();
          if (userResponse.success && userResponse.data) {
            setUser(userResponse.data);
          }
        } catch (error) {
          // Silently fail, profile is still saved
        }

        // Step 4: Reload profile to sync with backend
        await loadProfile();

        // Close modal after short delay
        setTimeout(() => {
          onCancel();
        }, 500);
      }
    } catch (err: any) {
      // Handle validation errors
      if (err.errorFields) {
        return; // Form validation errors, don't show message
      }

      const axiosError = err as AxiosError<any>;
      let errorMessage = "Failed to update profile";

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
   * Format date
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <Modal
        title={
          <Space size={12}>
            <UserOutlined style={{ fontSize: 20 }} />
            <span>Profile Settings</span>
          </Space>
        }
        open={open}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="Save Changes"
        okButtonProps={{
          disabled: !hasUnsavedChanges || isLoading,
          icon: <SaveOutlined />,
        }}
        cancelText="Close"
        confirmLoading={isSaving}
        width={680}
        centered
        className={styles.profileModal}
        destroyOnClose
        maskClosable={!hasUnsavedChanges}
      >
        <div className={styles.modalDescription}>
          âœ¨ Manage your profile information and security settings
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
            <Skeleton active avatar paragraph={{ rows: 2 }} />
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : (
          <div className={styles.profileContent}>
            {/* Avatar Section */}
            <div className={styles.avatarSection}>
              <AvatarUpload
                currentAvatarUrl={profile?.avatar_url || null}
                onFileSelect={handleAvatarFileSelect}
              />
            </div>

            <Divider className={styles.divider} />

            {/* Personal Information Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <UserOutlined className={styles.sectionIcon} />
                <h4 className={styles.sectionTitle}>Personal Information</h4>
              </div>

              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleFormChange}
                className={styles.profileForm}
              >
                {/* Username */}
                <Form.Item
                  name="username"
                  label="Username"
                  help="ðŸ”¤ Your unique username (3-50 characters)"
                  rules={[
                    {
                      min: 3,
                      message: "Username must be at least 3 characters",
                    },
                    {
                      max: 50,
                      message: "Username must not exceed 50 characters",
                    },
                  ]}
                >
                  <Input
                    placeholder="Enter username"
                    prefix={<UserOutlined />}
                    maxLength={50}
                    disabled={isLoading || isSaving}
                  />
                </Form.Item>

                {/* Bio */}
                <Form.Item
                  name="bio"
                  label="Bio"
                  help="âœï¸ Tell us about yourself (optional, max 200 characters)"
                  rules={[
                    {
                      max: 200,
                      message: "Bio must not exceed 200 characters",
                    },
                  ]}
                >
                  <TextArea
                    placeholder="Tell us about yourself..."
                    rows={3}
                    maxLength={200}
                    showCount
                    disabled={isLoading || isSaving}
                  />
                </Form.Item>

                {/* Email (Read-only) */}
                <Form.Item
                  label="Email"
                  help="ðŸ“§ Email address cannot be changed"
                >
                  <Input
                    value={profile?.email}
                    disabled
                    prefix={<MailOutlined />}
                  />
                </Form.Item>

                {/* Member Since (Read-only) */}
                <Form.Item label="Member Since" help="ðŸ“… Account creation date">
                  <Input
                    value={profile ? formatDate(profile.createdAt) : ""}
                    disabled
                    prefix={<CalendarOutlined />}
                  />
                </Form.Item>
              </Form>
            </div>

            <Divider className={styles.divider} />

            {/* Security Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <LockOutlined className={styles.sectionIcon} />
                <h4 className={styles.sectionTitle}>Security</h4>
              </div>

              <div className={styles.passwordRow}>
                <div>
                  <strong>Password</strong>
                  <br />
                  <span className={styles.passwordHidden}>â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢</span>
                </div>
                <Button
                  icon={<LockOutlined />}
                  onClick={() => setShowPasswordModal(true)}
                  disabled={isLoading || isSaving}
                >
                  Change Password
                </Button>
              </div>

              <div className={styles.hint}>
                ðŸ” <strong>Security Tip:</strong> Use a strong password with at
                least 8 characters, including uppercase, lowercase, and numbers.
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};

export default ProfileModal;
