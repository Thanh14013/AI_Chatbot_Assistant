/**
 * FileUpload Model
 * Handles database operations for file uploads
 */

import pool from "../db/pool.js";

// Type definitions
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
  uploaded_by: string; // UUID
  conversation_id?: string; // UUID
  message_id?: string; // UUID
  extracted_text?: string;
  thumbnail_url?: string;
  status?: "uploaded" | "processing" | "processed" | "failed";
  error_message?: string;
  metadata?: Record<string, any>;
  openai_file_id?: string; // OpenAI File API ID
  created_at?: Date;
  updated_at?: Date;
}

export class FileUploadModel {
  /**
   * Create new file upload record
   */
  static async create(
    data: Omit<FileUploadMetadata, "id" | "created_at" | "updated_at">
  ): Promise<FileUploadMetadata> {
    const query = `
      INSERT INTO files_upload (
        public_id, secure_url, resource_type, format, original_filename,
        size_bytes, width, height, duration, pages, uploaded_by,
        conversation_id, message_id, extracted_text, thumbnail_url, status, metadata, openai_file_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      data.public_id,
      data.secure_url,
      data.resource_type,
      data.format || null,
      data.original_filename || null,
      data.size_bytes || null,
      data.width || null,
      data.height || null,
      data.duration || null,
      data.pages || null,
      data.uploaded_by,
      data.conversation_id || null,
      data.message_id || null,
      data.extracted_text || null,
      data.thumbnail_url || null,
      data.status || "uploaded",
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.openai_file_id || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get file upload by ID
   */
  static async findById(id: number): Promise<FileUploadMetadata | null> {
    const query = "SELECT * FROM files_upload WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get file upload by public_id
   */
  static async findByPublicId(publicId: string): Promise<FileUploadMetadata | null> {
    const query = "SELECT * FROM files_upload WHERE public_id = $1";
    const result = await pool.query(query, [publicId]);
    return result.rows[0] || null;
  }

  /**
   * Get file upload by openai_file_id
   */
  static async findByOpenAIFileId(openaiFileId: string): Promise<FileUploadMetadata | null> {
    const query = "SELECT * FROM files_upload WHERE openai_file_id = $1";
    const result = await pool.query(query, [openaiFileId]);
    return result.rows[0] || null;
  }

  /**
   * Get all files for a message
   */
  static async findByMessageId(messageId: string): Promise<FileUploadMetadata[]> {
    const query = "SELECT * FROM files_upload WHERE message_id = $1 ORDER BY created_at ASC";
    const result = await pool.query(query, [messageId]);
    return result.rows;
  }

  /**
   * Get all files for a conversation
   */
  static async findByConversationId(conversationId: string): Promise<FileUploadMetadata[]> {
    const query = "SELECT * FROM files_upload WHERE conversation_id = $1 ORDER BY created_at DESC";
    const result = await pool.query(query, [conversationId]);
    return result.rows;
  }

  /**
   * Update file upload
   */
  static async update(
    id: number,
    data: Partial<FileUploadMetadata>
  ): Promise<FileUploadMetadata | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === "metadata" ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE files_upload
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update message_id for file uploads
   */
  static async updateMessageId(publicIds: string[], messageId: string): Promise<void> {
    const query = `
      UPDATE files_upload
      SET message_id = $1
      WHERE public_id = ANY($2)
    `;
    await pool.query(query, [messageId, publicIds]);
  }

  /**
   * Delete file upload
   */
  static async delete(id: number): Promise<boolean> {
    const query = "DELETE FROM files_upload WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Delete files by message ID
   */
  static async deleteByMessageId(messageId: string): Promise<void> {
    const query = "DELETE FROM files_upload WHERE message_id = $1";
    await pool.query(query, [messageId]);
  }

  /**
   * Get user's upload statistics
   */
  static async getUserStats(userId: string): Promise<{
    total_files: number;
    total_size_bytes: number;
    file_types: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(size_bytes), 0) as total_size_bytes,
        json_object_agg(resource_type, type_count) as file_types
      FROM (
        SELECT resource_type, COUNT(*) as type_count
        FROM files_upload
        WHERE uploaded_by = $1
        GROUP BY resource_type
      ) as types,
      files_upload
      WHERE uploaded_by = $1
      GROUP BY types.resource_type, types.type_count
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || { total_files: 0, total_size_bytes: 0, file_types: {} };
  }
}

export default FileUploadModel;
