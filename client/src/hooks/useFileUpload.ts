/**
 * useFileUpload Hook
 * Custom hook for handling file uploads with Cloudinary
 */

import { useState, useCallback } from "react";
import { fileUploadService } from "../services/fileUpload.service";
import type { FileAttachment } from "../types/file.types";

interface UseFileUploadOptions {
  conversationId?: string;
  onUploadSuccess?: (file: FileAttachment) => void;
  onUploadError?: (error: Error) => void;
}

export const useFileUpload = (options?: UseFileUploadOptions) => {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

  /**
   * Upload single file
   */
  const uploadFile = useCallback(
    async (file: File): Promise<FileAttachment | null> => {
      // Validate file
      const validation = fileUploadService.validateFile(file);
      if (!validation.valid) {
        const error = new Error(validation.error);
        options?.onUploadError?.(error);
        throw error;
      }

      setUploading(true);

      try {
        // Create temporary ID for tracking progress
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Add to attachments with uploading status
        const tempAttachment: FileAttachment = {
          public_id: tempId,
          secure_url: "",
          resource_type: file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
            ? "video"
            : "raw",
          original_filename: file.name,
          status: "uploading",
          progress: 0,
        };

        setAttachments((prev) => [...prev, tempAttachment]);
        setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

        // Upload file with progress tracking
        const uploadedFile = await fileUploadService.uploadFile(file, {
          conversation_id: options?.conversationId,
          onProgress: (progress) => {
            setUploadProgress((prev) => ({ ...prev, [tempId]: progress }));

            // Update attachment progress
            setAttachments((prev) =>
              prev.map((att) =>
                att.public_id === tempId ? { ...att, progress } : att
              )
            );
          },
        });

        // Update with final uploaded file
        setAttachments((prev) =>
          prev.map((att) =>
            att.public_id === tempId
              ? { ...uploadedFile, status: "uploaded" as const, progress: 100 }
              : att
          )
        );

        // Clean up progress tracking
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[tempId];
          return newProgress;
        });

        options?.onUploadSuccess?.(uploadedFile);
        return uploadedFile;
      } catch (error) {
        console.error("Upload error:", error);
        const err = error instanceof Error ? error : new Error("Upload failed");
        options?.onUploadError?.(err);

        // Remove failed upload from list
        setAttachments((prev) =>
          prev.filter((att) => att.status !== "uploading")
        );

        return null;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  /**
   * Upload multiple files
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<FileAttachment[]> => {
      const results = await Promise.allSettled(
        Array.from(files).map((file) => uploadFile(file))
      );

      return results
        .filter(
          (result): result is PromiseFulfilledResult<FileAttachment> =>
            result.status === "fulfilled" && result.value !== null
        )
        .map((result) => result.value);
    },
    [uploadFile]
  );

  /**
   * Remove attachment by public_id
   */
  const removeAttachment = useCallback((public_id: string) => {
    setAttachments((prev) => prev.filter((att) => att.public_id !== public_id));
  }, []);

  /**
   * Clear all attachments
   */
  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setUploadProgress({});
  }, []);

  /**
   * Delete attachment from server and local state
   */
  const deleteAttachment = useCallback(async (fileId: number) => {
    try {
      await fileUploadService.deleteFile(fileId);
      setAttachments((prev) => prev.filter((att) => att.id !== fileId));
    } catch (error) {
      console.error("Delete error:", error);
      throw error;
    }
  }, []);

  return {
    attachments,
    uploading,
    uploadProgress,
    uploadFile,
    uploadFiles,
    removeAttachment,
    clearAttachments,
    deleteAttachment,
  };
};
