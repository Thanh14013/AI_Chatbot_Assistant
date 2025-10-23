/**
 * Project Service
 * API calls for project management
 */

import axiosInstance from "./axios.service";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../types/project.type";
import type { ConversationListItem } from "../types/chat.type";

/**
 * Get all projects for authenticated user
 */
export const getProjects = async (): Promise<Project[]> => {
  const response = await axiosInstance.get("/projects");
  return response.data.data;
};

/**
 * Create a new project
 */
export const createProject = async (
  input: CreateProjectInput
): Promise<Project> => {
  const response = await axiosInstance.post("/projects", input);
  return response.data.data;
};

/**
 * Update a project
 */
export const updateProject = async (
  projectId: string,
  input: UpdateProjectInput
): Promise<Project> => {
  const response = await axiosInstance.put(`/projects/${projectId}`, input);
  return response.data.data;
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  await axiosInstance.delete(`/projects/${projectId}`);
};

/**
 * Get all conversations in a project
 */
export const getProjectConversations = async (
  projectId: string
): Promise<ConversationListItem[]> => {
  const response = await axiosInstance.get(
    `/projects/${projectId}/conversations`
  );
  return response.data.data;
};

/**
 * Move a conversation to a project (or remove from project if projectId is null)
 */
export const moveConversationToProject = async (
  conversationId: string,
  projectId: string | null
): Promise<void> => {
  await axiosInstance.put(`/conversations/${conversationId}/move`, {
    projectId,
  });
};

/**
 * Update conversation orders within a project
 */
export const updateConversationOrders = async (
  projectId: string,
  orders: Array<{ conversationId: string; order: number }>
): Promise<void> => {
  await axiosInstance.put(`/projects/${projectId}/conversations/order`, {
    orders,
  });
};
