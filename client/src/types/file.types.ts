/**
 * File Upload Types
 * Type definitions for file attachments and uploads
 */

export interface FileAttachment {
  id?: number;
  public_id: string;
  secure_url: string;
  resource_type: "image" | "video" | "raw";
  format?: string;
  original_filename?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  thumbnail_url?: string;
  status?: "uploading" | "uploaded" | "processing" | "processed" | "failed";
  progress?: number;
  error?: string;
  extracted_text?: string;
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface CloudinarySignature {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder: string;
  resource_type?: string;
  access_mode?: string;
}

export interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  created_at: string;
  bytes: number;
  url: string;
  secure_url: string;
  original_filename?: string;
  pages?: number;
  duration?: number;
}

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  error?: string;
  attachment?: FileAttachment;
}

export interface AttachmentPayload {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  extracted_text?: string;
}
