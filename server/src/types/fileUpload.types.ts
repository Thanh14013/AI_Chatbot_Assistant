export interface FileUploadMetadata {
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
  uploaded_by: number;
  conversation_id?: number;
  message_id?: number;
  extracted_text?: string;
  thumbnail_url?: string;
  status?: "uploaded" | "processing" | "processed" | "failed";
  error_message?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
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
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  original_filename?: string;
  api_key: string;
  pages?: number;
  duration?: number;
}

export interface CloudinarySignatureParams {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder?: string;
  upload_preset?: string;
}

export interface FileProcessingResult {
  extracted_text?: string;
  pages?: number;
  thumbnail_url?: string;
  error?: string;
}

export interface AttachmentPayload {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  original_filename?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  thumbnail_url?: string;
  metadata?: Record<string, any>;
}
