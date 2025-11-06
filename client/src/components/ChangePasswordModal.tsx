/**
 * Change Password Modal Component
 * Allows users to change their password with validation
 */

import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Progress,
  Typography,
  message,
} from "antd";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import {
  changePassword,
  type ChangePasswordInput,
} from "../services/user-profile.service";
import styles from "./ChangePasswordModal.module.css";

const { Text } = Typography;

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface PasswordStrength {
  score: number; // 0-100
  level: "weak" | "medium" | "strong" | "very-strong";
  color: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Calculate password strength
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      longLength: password.length >= 12,
    };

    // Calculate score
    if (checks.length) score += 25;
    if (checks.uppercase) score += 20;
    if (checks.lowercase) score += 20;
    if (checks.number) score += 20;
    if (checks.special) score += 10;
    if (checks.longLength) score += 5;

    // Determine level and color
    let level: PasswordStrength["level"];
    let color: string;

    if (score >= 90) {
      level = "very-strong";
      color = "#1890ff"; // Blue
    } else if (score >= 70) {
      level = "strong";
      color = "#52c41a"; // Green
    } else if (score >= 50) {
      level = "medium";
      color = "#faad14"; // Orange
    } else {
      level = "weak";
      color = "#ff4d4f"; // Red
    }

    return { score, level, color };
  };

  const strength = calculatePasswordStrength(newPassword);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setLoading(true);

      const data: ChangePasswordInput = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmPassword,
      };

      await changePassword(data);

      message.success("Password changed successfully!");
      form.resetFields();
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.errorFields) {
        // Form validation error
        message.error("Please fix the errors in the form");
      } else {
        message.error("Failed to change password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Modal
      title="Change Password"
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          Change Password
        </Button>,
      ]}
      className={styles.modal}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className={styles.form}>
        {/* Current Password */}
        <Form.Item
          name="currentPassword"
          label="Current Password"
          rules={[
            { required: true, message: "Please enter your current password" },
          ]}
        >
          <Input.Password
            placeholder="Enter current password"
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
            visibilityToggle={{
              visible: showCurrent,
              onVisibleChange: setShowCurrent,
            }}
          />
        </Form.Item>

        {/* New Password */}
        <Form.Item
          name="newPassword"
          label="New Password"
          rules={[
            { required: true, message: "Please enter a new password" },
            { min: 8, message: "Password must be at least 8 characters" },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                if (!/[A-Z]/.test(value)) {
                  return Promise.reject(
                    "Must contain at least one uppercase letter"
                  );
                }
                if (!/[a-z]/.test(value)) {
                  return Promise.reject(
                    "Must contain at least one lowercase letter"
                  );
                }
                if (!/\d/.test(value)) {
                  return Promise.reject("Must contain at least one number");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input.Password
            placeholder="Enter new password"
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
            visibilityToggle={{ visible: showNew, onVisibleChange: setShowNew }}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Form.Item>

        {/* Password Strength Meter */}
        {newPassword && (
          <div className={styles.strengthMeter}>
            <Text className={styles.strengthLabel}>Password Strength</Text>
            <Progress
              percent={strength.score}
              strokeColor={strength.color}
              showInfo={false}
              className={styles.progressBar}
            />
            <Text
              className={styles.strengthLevel}
              style={{ color: strength.color }}
            >
              {strength.level.replace("-", " ").toUpperCase()}
            </Text>

            {/* Requirements Checklist */}
            <div className={styles.requirements}>
              <Text className={styles.requirementsTitle}>Requirements:</Text>
              <div className={styles.requirementItem}>
                {newPassword.length >= 8 ? (
                  <CheckCircleOutlined className={styles.iconCheck} />
                ) : (
                  <CloseCircleOutlined className={styles.iconCross} />
                )}
                <Text>At least 8 characters</Text>
              </div>
              <div className={styles.requirementItem}>
                {/[A-Z]/.test(newPassword) ? (
                  <CheckCircleOutlined className={styles.iconCheck} />
                ) : (
                  <CloseCircleOutlined className={styles.iconCross} />
                )}
                <Text>One uppercase letter</Text>
              </div>
              <div className={styles.requirementItem}>
                {/[a-z]/.test(newPassword) ? (
                  <CheckCircleOutlined className={styles.iconCheck} />
                ) : (
                  <CloseCircleOutlined className={styles.iconCross} />
                )}
                <Text>One lowercase letter</Text>
              </div>
              <div className={styles.requirementItem}>
                {/\d/.test(newPassword) ? (
                  <CheckCircleOutlined className={styles.iconCheck} />
                ) : (
                  <CloseCircleOutlined className={styles.iconCross} />
                )}
                <Text>One number</Text>
              </div>
              <div className={styles.requirementItem}>
                {/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? (
                  <CheckCircleOutlined className={styles.iconCheck} />
                ) : (
                  <CloseCircleOutlined className={styles.iconCross} />
                )}
                <Text>One special character (optional)</Text>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Password */}
        <Form.Item
          name="confirmPassword"
          label="Confirm New Password"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Please confirm your new password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject("Passwords do not match");
              },
            }),
          ]}
        >
          <Input.Password
            placeholder="Confirm new password"
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
            visibilityToggle={{
              visible: showConfirm,
              onVisibleChange: setShowConfirm,
            }}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Form.Item>

        {/* Password Match Indicator */}
        {newPassword && confirmPassword && (
          <div className={styles.matchIndicator}>
            {newPassword === confirmPassword ? (
              <>
                <CheckCircleOutlined className={styles.iconCheck} />
                <Text style={{ color: "#52c41a" }}>Passwords match</Text>
              </>
            ) : (
              <>
                <CloseCircleOutlined className={styles.iconCross} />
                <Text style={{ color: "#ff4d4f" }}>Passwords do not match</Text>
              </>
            )}
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
