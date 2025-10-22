/**
 * FileAttachmentPreview Component
 * Displays preview thumbnails of uploaded files
 */

import React from "react";
import type { FileAttachment } from "../types/file.types";
import styles from "./FileAttachmentPreview.module.css";

interface FileAttachmentPreviewProps {
  attachments: FileAttachment[];
  onRemove?: (public_id: string) => void;
  uploadProgress?: Record<string, number>;
  readOnly?: boolean;
}

export const FileAttachmentPreview: React.FC<FileAttachmentPreviewProps> = ({
  attachments,
  onRemove,
  uploadProgress,
  readOnly = false,
}) => {
  if (attachments.length === 0) {
    return null;
  }

  const getFileIcon = (resourceType: string, filename?: string) => {
    if (resourceType === "image") return "🖼️";
    if (resourceType === "video") return "🎥";

    // Determine icon by file extension
    const ext = filename?.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (["doc", "docx"].includes(ext || "")) return "📝";
    if (["xls", "xlsx", "csv"].includes(ext || "")) return "📊";
    if (["zip", "rar", "7z"].includes(ext || "")) return "📦";

    return "📎";
  };

  return (
    <div className={styles.attachmentsList}>
      {attachments.map((attachment) => {
        const isUploading = attachment.status === "uploading";
        const progress =
          uploadProgress?.[attachment.public_id] || attachment.progress || 0;

        return (
          // eslint-disable-next-line react/forbid-dom-props
          <div
            key={attachment.public_id}
            className={styles.attachmentItem}
            style={
              {
                ["--upload-progress" as string]: `${progress}%`,
              } as React.CSSProperties
            }
          >
            {attachment.resource_type === "image" ? (
              <img
                src={attachment.thumbnail_url || attachment.secure_url}
                alt={attachment.original_filename || "Image"}
                className={styles.attachmentImage}
                loading="lazy"
              />
            ) : (
              <div className={styles.attachmentFile}>
                <span className={styles.fileIcon}>
                  {getFileIcon(
                    attachment.resource_type,
                    attachment.original_filename
                  )}
                </span>
                <span className={styles.fileName}>
                  {attachment.original_filename || "File"}
                </span>
              </div>
            )}

            {/* Uploading overlay with progress */}
            {isUploading && (
              <>
                <div className={styles.uploadingOverlay}>
                  {Math.round(progress)}%
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} />
                </div>
              </>
            )}

            {/* Error overlay */}
            {attachment.status === "failed" && (
              <div className={styles.errorOverlay}>Upload failed</div>
            )}

            {/* Remove button */}
            {!readOnly && !isUploading && onRemove && (
              <button
                className={styles.removeButton}
                onClick={() => onRemove(attachment.public_id)}
                aria-label="Remove attachment"
                type="button"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
