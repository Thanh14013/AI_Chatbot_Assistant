/**
 * Project related type definitions - Client side
 */

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  order: number;
  conversationCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
}
