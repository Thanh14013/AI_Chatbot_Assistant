/**
 * Profile Page Component
 * Main page for user profile management
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Divider,
  Typography,
  Space,
  message,
  Modal,
  Skeleton,
} from "antd";
import { UserOutlined, LockOutlined, SaveOutlined } from "@ant-design/icons";
import { AvatarUpload } from "../components/AvatarUpload";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
  type UpdateProfileInput,
} from "../services/user-profile.service";
import styles from "./ProfilePage.module.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

export const ProfilePage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [bioLength, setBioLength] = useState(0);

  const originalValuesRef = useRef<UpdateProfileInput>({});

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await getUserProfile();

      if (response.success && response.data) {
        setProfile(response.data);
        const formValues = {
          username: response.data.username || "",
          bio: response.data.bio || "",
        };
        form.setFieldsValue(formValues);
        originalValuesRef.current = formValues;
        setBioLength(response.data.bio?.length || 0);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  // Track form changes
  const handleFormChange = () => {
    const currentValues = form.getFieldsValue();
    const hasChanges =
      currentValues.username !== originalValuesRef.current.username ||
      currentValues.bio !== originalValuesRef.current.bio;
    setHasUnsavedChanges(hasChanges);
  };

  // Handle avatar change
  const handleAvatarChange = (newAvatarUrl: string | null) => {
    if (profile) {
      setProfile({ ...profile, avatar_url: newAvatarUrl });
    }
  };

  // Handle bio change for character counter
  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBioLength(e.target.value.length);
    handleFormChange();
  };

  // Save profile
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const updates: UpdateProfileInput = {
        username: values.username || null,
        bio: values.bio || null,
      };

      const response = await updateUserProfile(updates);

      if (response.success && response.data) {
        setProfile(response.data);
        originalValuesRef.current = {
          username: response.data.username,
          bio: response.data.bio,
        };
        setHasUnsavedChanges(false);
        message.success("Profile updated successfully!");
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.errorFields) {
        message.error("Please fix the errors in the form");
      } else {
        message.error("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: "Discard changes?",
        content:
          "You have unsaved changes. Are you sure you want to discard them?",
        okText: "Discard",
        okType: "danger",
        onOk: () => {
          form.setFieldsValue(originalValuesRef.current);
          setHasUnsavedChanges(false);
          setBioLength(originalValuesRef.current.bio?.length || 0);
        },
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <Skeleton avatar active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.container}>
        <Card>
          <Text type="danger">Failed to load profile</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          <UserOutlined /> Profile Settings
        </Title>
      </div>

      <Card className={styles.card}>
        {/* Avatar Section */}
        <div className={styles.section}>
          <AvatarUpload
            currentAvatarUrl={profile.avatar_url}
            onAvatarChange={handleAvatarChange}
          />
        </div>

        <Divider />

        {/* Basic Information */}
        <div className={styles.section}>
          <Title level={4} className={styles.sectionTitle}>
            Basic Information
          </Title>

          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleFormChange}
            className={styles.form}
          >
            {/* Username */}
            <Form.Item
              name="username"
              label="Username"
              rules={[
                {
                  pattern: /^[a-zA-Z0-9_]*$/,
                  message:
                    "Username can only contain letters, numbers, and underscores",
                },
                {
                  min: 3,
                  message: "Username must be at least 3 characters",
                },
                {
                  max: 50,
                  message: "Username must not exceed 50 characters",
                },
              ]}
              extra="Your unique username (3-50 characters, letters, numbers, and underscores)"
            >
              <Input
                placeholder="Enter username"
                prefix={<UserOutlined />}
                maxLength={50}
              />
            </Form.Item>

            {/* Email (Read-only) */}
            <Form.Item label="Email">
              <Input value={profile.email} disabled prefix={<UserOutlined />} />
              <Text type="secondary" className={styles.readonlyHint}>
                Email cannot be changed
              </Text>
            </Form.Item>

            {/* Member Since (Read-only) */}
            <Form.Item label="Member Since">
              <Input value={formatDate(profile.createdAt)} disabled />
            </Form.Item>
          </Form>
        </div>

        <Divider />

        {/* About Section */}
        <div className={styles.section}>
          <Title level={4} className={styles.sectionTitle}>
            About
          </Title>

          <Form form={form} layout="vertical" className={styles.form}>
            <Form.Item
              name="bio"
              label="Bio"
              rules={[
                {
                  max: 200,
                  message: "Bio must not exceed 200 characters",
                },
              ]}
            >
              <TextArea
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={200}
                onChange={handleBioChange}
                showCount={{
                  formatter: ({ count }) => `${count}/200 characters`,
                }}
              />
            </Form.Item>
          </Form>
        </div>

        <Divider />

        {/* Security Section */}
        <div className={styles.section}>
          <Title level={4} className={styles.sectionTitle}>
            Security
          </Title>

          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div className={styles.passwordRow}>
              <div>
                <Text strong>Password</Text>
                <br />
                <Text type="secondary">••••••••••</Text>
              </div>
              <Button
                icon={<LockOutlined />}
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </Button>
            </div>
          </Space>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button
            onClick={handleCancel}
            disabled={!hasUnsavedChanges || saving}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasUnsavedChanges}
          >
            Save Changes
          </Button>
        </div>
      </Card>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default ProfilePage;
