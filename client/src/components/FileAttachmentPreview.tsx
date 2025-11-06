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
    if (resourceType === "image") return "ðŸ–¼ï¸";
    if (resourceType === "video") return "ðŸŽ¥";

    // Determine icon by file extension
    const ext = filename?.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "ðŸ“„";
    if (["doc", "docx"].includes(ext || "")) return "ðŸ“";
    if (["xls", "xlsx", "csv"].includes(ext || "")) return "ðŸ“Š";
    if (["zip", "rar", "7z"].includes(ext || "")) return "ðŸ“¦";

    return "ðŸ“Ž";
  };

  return (
    <div className={styles.attachmentsList}>
      {attachments.map((attachment) => {
        const isUploading = attachment.status === "uploading";
        const isProcessing = attachment.status === "processing";
        const isFailed = attachment.status === "failed";
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
            title={
              isProcessing
                ? "Processing file... (extracting text from PDF)"
                : attachment.original_filename || "File"
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

            {/* Processing overlay (for PDFs being parsed) */}
            {isProcessing && (
              <div className={styles.processingOverlay}>
                <span className={styles.processingSpinner}>â³</span>
                <span>Processing...</span>
              </div>
            )}

            {/* Error overlay */}
            {isFailed && (
              <div className={styles.errorOverlay}>
                {attachment.error || "Upload failed"}
              </div>
            )}

            {/* Remove button */}
            {!readOnly && !isUploading && !isProcessing && onRemove && (
              <button
                className={styles.removeButton}
                onClick={() => onRemove(attachment.public_id)}
                aria-label="Remove attachment"
                type="button"
              >
                Ã—
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
