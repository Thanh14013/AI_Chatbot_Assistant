/**
 * Drag and Drop type definitions
 */

export interface DraggedItem {
  conversationId: string;
  sourceProjectId: string | null; // null if from "All Conversations"
}

export interface DropTarget {
  projectId: string | null; // null if dropping to "All Conversations"
  isValid: boolean;
  type: "project" | "all-conversations" | null;
}

export interface DragDropState {
  draggedItem: DraggedItem | null;
  dropTarget: DropTarget | null;
  isDragging: boolean;
}
