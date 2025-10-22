/**
 * Avatar Upload Component
 * Handles avatar preview and file selection (upload happens on save)
 */

import React, { useState, useEffect } from "react";
import { Avatar, Button, Upload, message } from "antd";
import {
  UserOutlined,
  CameraOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import styles from "./AvatarUpload.module.css";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onFileSelect?: (file: File | null, action: "upload" | "remove") => void;
  onAvatarChange?: (newAvatarUrl: string | null) => void;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  onFileSelect,
  onAvatarChange,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl || null
  );
  const [hasLocalChange, setHasLocalChange] = useState(false);

  // Update preview when currentAvatarUrl changes
  useEffect(() => {
    if (!hasLocalChange) {
      setPreviewUrl(currentAvatarUrl || null);
    }
  }, [currentAvatarUrl, hasLocalChange]);

  // Validate file before upload
  const validateFile = (file: File): boolean => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      message.error("Only JPG, PNG, and WebP images are allowed");
      return false;
    }

    if (file.size > maxSize) {
      message.error("Image must be smaller than 5MB");
      return false;
    }

    return true;
  };

  // Handle file selection (preview only, upload on save)
  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    // Create local preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setPreviewUrl(previewUrl);
      setHasLocalChange(true);
      // Notify parent with new avatar URL
      onAvatarChange?.(previewUrl);
    };
    reader.readAsDataURL(file);

    // Notify parent with file
    onFileSelect?.(file, "upload");
  };

  // Handle remove avatar (mark for removal on save)
  const handleRemove = () => {
    setPreviewUrl(null);
    setHasLocalChange(true);
    onFileSelect?.(null, "remove");
    // Notify parent that avatar was removed
    onAvatarChange?.(null);
  };

  // Upload props for Ant Design Upload component
  const uploadProps: UploadProps = {
    accept: "image/jpeg,image/png,image/webp",
    beforeUpload: (file) => {
      handleFileSelect(file);
      return false; // Prevent auto upload
    },
    showUploadList: false,
  };

  const displayUrl = previewUrl;

  return (
    <div className={styles.container}>
      <div className={styles.avatarWrapper}>
        <Avatar
          size={150}
          icon={<UserOutlined />}
          src={displayUrl}
          className={styles.avatar}
        />

        <Upload {...uploadProps}>
          <Button
            icon={<CameraOutlined />}
            className={styles.changeButton}
            type="primary"
            shape="circle"
          />
        </Upload>
      </div>

      <div className={styles.actions}>
        {displayUrl ? (
          <>
            <Upload {...uploadProps}>
              <Button icon={<CameraOutlined />}>Change Photo</Button>
            </Upload>
            <Button icon={<DeleteOutlined />} onClick={handleRemove} danger>
              Remove
            </Button>
          </>
        ) : (
          <Upload {...uploadProps}>
            <Button icon={<CameraOutlined />} type="primary">
              Upload Photo
            </Button>
          </Upload>
        )}
      </div>

      <div className={styles.hint}>Supported: JPG, PNG, WebP (Max 5MB)</div>
    </div>
  );
};

export default AvatarUpload;
