/**
 * ProjectSection Component
 * Container for displaying all projects with their conversations
 */

import React, { useState, useEffect } from "react";
import { Button, App } from "antd";
import { PlusOutlined, FolderOutlined } from "@ant-design/icons";
import type { Project } from "../types/project.type";
import type { ConversationListItem } from "../types/chat.type";
import ProjectCard from "./ProjectCard";
import ProjectModal from "./ProjectModal";
import ConversationForm, { ConversationFormValues } from "./ConversationForm";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectConversations,
} from "../services/project.service";
import { websocketService } from "../services/websocket.service";
import { createConversation } from "../services/chat.service";
import styles from "./ProjectSection.module.css";

interface ProjectSectionProps {
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: (projectId?: string) => void;
  currentConversationId?: string;
  refreshTrigger?: number; // External trigger to refresh projects
  // Drag & Drop
  onDragStart?: (conversationId: string, projectId: string | null) => void;
  onDragEnd?: () => void;
  onDragOver?: (projectId: string, isValid: boolean) => void;
  onDrop?: (
    projectId: string,
    conversationId: string,
    sourceProjectId: string | null
  ) => void;
  onDragLeave?: () => void;
  draggedConversationId?: string | null;
  dropTargetProjectId?: string | null;
  isDropTargetValid?: boolean;
}

const ProjectSection: React.FC<ProjectSectionProps> = ({
  onSelectConversation,
  onNewConversation,
  currentConversationId,
  refreshTrigger,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  draggedConversationId = null,
  dropTargetProjectId = null,
  isDropTargetValid = false,
}) => {
  const { message } = App.useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectConversations, setProjectConversations] = useState<
    Record<string, ConversationListItem[]>
  >({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [showProjects, setShowProjects] = useState(true); // Toggle PROJECTS section
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [conversationModalVisible, setConversationModalVisible] =
    useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  // Load projects
  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error: any) {
      message.error(error.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  // Load conversations for a specific project
  const loadProjectConversations = async (projectId: string) => {
    try {
      const conversations = await getProjectConversations(projectId);
      setProjectConversations((prev) => ({
        ...prev,
        [projectId]: conversations,
      }));
    } catch (error: any) {
      message.error(error.message || "Failed to load project conversations");
    }
  };

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [refreshTrigger]);

  // Listen to realtime project events via WebSocket
  useEffect(() => {
    const handleProjectCreated = (e: Event) => {
      const project = (e as CustomEvent).detail as Project;
      setProjects((prev) => [...prev, project]);
    };

    const handleProjectUpdated = (e: Event) => {
      const project = (e as CustomEvent).detail as Project;
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? project : p))
      );
    };

    const handleProjectDeleted = (e: Event) => {
      const data = (e as CustomEvent).detail as { projectId: string };
      setProjects((prev) => prev.filter((p) => p.id !== data.projectId));
      // Remove from expanded set
      setExpandedProjects((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.projectId);
        return newSet;
      });
      // Remove project conversations
      setProjectConversations((prev) => {
        const newConvs = { ...prev };
        delete newConvs[data.projectId];
        return newConvs;
      });
    };

    const handleConversationCreated = (e: Event) => {
      const conversation = (e as CustomEvent).detail as ConversationListItem;

      // If conversation belongs to a project, update that project's conversations
      if (conversation.project_id) {
        setProjectConversations((prev) => {
          const projectConvs = prev[conversation.project_id!] || [];
          return {
            ...prev,
            [conversation.project_id!]: [...projectConvs, conversation],
          };
        });

        // Auto-expand the project to show new conversation
        setExpandedProjects((prev) => {
          const newSet = new Set(prev);
          newSet.add(conversation.project_id!);
          return newSet;
        });

        // Reload projects to update conversation count
        loadProjects();
      }
    };

    const handleConversationUpdated = (e: Event) => {
      const data = (e as CustomEvent).detail as {
        conversationId: string;
        conversation: ConversationListItem;
      };

      // If conversation belongs to a project, reload fresh data from server
      if (data.conversation.project_id) {
        const projectId = data.conversation.project_id;

        // Reload conversations for this project to ensure fresh data (name, tags, etc.)
        loadProjectConversations(projectId);

        // Reload projects to update conversation count, latest updates, etc.
        loadProjects();
      }
    };

    const handleConversationDeleted = (e: Event) => {
      const data = (e as CustomEvent).detail as {
        conversationId: string;
      };

      // Remove conversation from all project conversations
      setProjectConversations((prev) => {
        const updated = { ...prev };
        for (const projectId in updated) {
          updated[projectId] = updated[projectId].filter(
            (conv) => conv.id !== data.conversationId
          );
        }
        return updated;
      });

      // Reload projects to update conversation count
      loadProjects();
    };

    const handleConversationMoved = (e: Event) => {
      const data = (e as CustomEvent).detail as {
        conversationId: string;
        oldProjectId: string | null;
        newProjectId: string | null;
      };

      // Remove from old project
      if (data.oldProjectId && typeof data.oldProjectId === "string") {
        setProjectConversations((prev) => {
          const updated = { ...prev };
          if (updated[data.oldProjectId!]) {
            updated[data.oldProjectId!] = updated[data.oldProjectId!].filter(
              (conv: ConversationListItem) => conv.id !== data.conversationId
            );
          }
          return updated;
        });
      }

      // Reload new project conversations if moved to a project
      if (data.newProjectId) {
        loadProjectConversations(data.newProjectId);

        // Auto-expand the target project to show the moved conversation
        setExpandedProjects((prev) => {
          const newSet = new Set(prev);
          newSet.add(data.newProjectId!);
          return newSet;
        });
      }

      // Reload all projects to update conversation counts
      loadProjects();
    };

    // Listen to custom window events triggered by websocket service
    window.addEventListener("project:created", handleProjectCreated);
    window.addEventListener("project:updated", handleProjectUpdated);
    window.addEventListener("project:deleted", handleProjectDeleted);
    window.addEventListener("conversation:created", handleConversationCreated);
    window.addEventListener("conversation:updated", handleConversationUpdated);
    window.addEventListener("conversation:deleted", handleConversationDeleted);
    window.addEventListener("conversation:moved", handleConversationMoved);

    // Cleanup
    return () => {
      window.removeEventListener("project:created", handleProjectCreated);
      window.removeEventListener("project:updated", handleProjectUpdated);
      window.removeEventListener("project:deleted", handleProjectDeleted);
      window.removeEventListener(
        "conversation:created",
        handleConversationCreated
      );
      window.removeEventListener(
        "conversation:updated",
        handleConversationUpdated
      );
      window.removeEventListener(
        "conversation:deleted",
        handleConversationDeleted
      );
      window.removeEventListener("conversation:moved", handleConversationMoved);
    };
  }, []);

  // Load conversations when project is expanded
  useEffect(() => {
    expandedProjects.forEach((projectId) => {
      if (!projectConversations[projectId]) {
        loadProjectConversations(projectId);
      }
    });
  }, [expandedProjects]);

  // Toggle project expand/collapse
  const handleToggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  // Handle create new project
  const handleNewProject = () => {
    setModalMode("create");
    setEditingProject(undefined);
    setModalVisible(true);
  };

  // Handle edit project
  const handleEditProject = (project: Project) => {
    setModalMode("edit");
    setEditingProject(project);
    setModalVisible(true);
  };

  // Handle delete project
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      message.success("Project deleted successfully");
      loadProjects();
      // Refresh conversations list
      window.dispatchEvent(new Event("conversations:refresh"));
    } catch (error: any) {
      message.error(error.message || "Failed to delete project");
    }
  };

  // Handle modal submit
  const handleModalSubmit = async (data: any) => {
    try {
      if (modalMode === "create") {
        const newProject = await createProject(data);
        message.success("Project created successfully");
      } else if (editingProject) {
        const updatedProject = await updateProject(editingProject.id, data);
        message.success("Project updated successfully");
      }
      setModalVisible(false);
      // Note: loadProjects() is called here as fallback, but realtime should handle it
      await loadProjects();
    } catch (error: any) {
      throw error;
    }
  };

  // Handle new conversation in project - open modal
  const handleNewConversation = (projectId: string) => {
    setSelectedProjectId(projectId);
    setConversationModalVisible(true);
  };

  // Handle conversation modal submit
  const handleConversationModalSubmit = async (
    values: ConversationFormValues
  ) => {
    if (!selectedProjectId) return;

    try {
      // Create conversation with project_id
      const newConversation = await createConversation({
        title: values.title,
        model: values.model,
        context_window: values.context_window,
        tags: values.tags,
        project_id: selectedProjectId, // Mark as belonging to this project
      });

      message.success("Conversation created successfully");
      setConversationModalVisible(false);
      setSelectedProjectId(null);

      // Auto-expand the project to show new conversation
      setExpandedProjects((prev) => {
        const newSet = new Set(prev);
        newSet.add(selectedProjectId);
        return newSet;
      });

      // Reload project conversations
      await loadProjectConversations(selectedProjectId);

      // Reload projects to update conversation count (don't dispatch conversation:created
      // because loadProjectConversations already added it to the list, dispatching would cause duplication)
      await loadProjects();

      // Refresh main conversation list
      window.dispatchEvent(new Event("conversations:refresh"));

      // Note: Backend broadcasts conversation:created to OTHER tabs (excludes sender socket)
    } catch (error: any) {
      message.error(error.message || "Failed to create conversation");
    }
  };

  // Handle drag over
  const handleDragOver = (projectId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    // ProjectCard will handle validation and call parent
  };

  // Handle drop
  const handleDrop = (projectId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    // ProjectCard will handle extraction and call parent
  };

  return (
    <div className={styles.projectSection}>
      {/* Clickable Projects Header - Toggle show/hide */}
      <div
        className={styles.compactHeader}
        onClick={() => setShowProjects(!showProjects)}
      >
        <div className={styles.headerLeft}>
          <FolderOutlined className={styles.headerIcon} />
          <span className={styles.headerText}>PROJECTS</span>
          <span className={styles.toggleIcon}>{showProjects ? "▼" : "▶"}</span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleNewProject();
          }}
          className={styles.addButton}
          title="Add new project"
        />
      </div>

      {/* Projects List - Show when toggled */}
      {showProjects && projects.length > 0 && (
        <div className={styles.projectsList}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              conversations={projectConversations[project.id] || []}
              isExpanded={expandedProjects.has(project.id)}
              onToggle={() => handleToggleProject(project.id)}
              onEdit={() => handleEditProject(project)}
              onDelete={() => handleDeleteProject(project.id)}
              onNewConversation={() => handleNewConversation(project.id)}
              onSelectConversation={onSelectConversation}
              currentConversationId={currentConversationId}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              isDropTarget={
                dropTargetProjectId === project.id && isDropTargetValid
              }
              isDropTargetInvalid={
                dropTargetProjectId === project.id && !isDropTargetValid
              }
              draggedConversationId={draggedConversationId}
              onConversationDragStart={onDragStart}
              onConversationDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}

      {/* Project Modal */}
      <ProjectModal
        visible={modalVisible}
        mode={modalMode}
        project={editingProject}
        onSubmit={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
      />

      {/* Conversation Creation Modal */}
      <ConversationForm
        open={conversationModalVisible}
        onCancel={() => {
          setConversationModalVisible(false);
          setSelectedProjectId(null);
        }}
        onSubmit={handleConversationModalSubmit}
        loading={false}
        mode="create"
      />
    </div>
  );
};

export default ProjectSection;
