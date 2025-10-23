/**
 * Project Type Definitions
 * Represents a project that groups multiple conversations
 */

export interface IProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string; // Hex color for visual identification
  icon: string | null; // Optional emoji or icon
  order: number; // Display order
  createdAt: Date;
  updatedAt: Date;
  deleted_at: Date | null;
}

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  order?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  order?: number;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  order: number;
  conversationCount: number; // Number of conversations in project
  createdAt: string | Date;
  updatedAt: string | Date;
}
