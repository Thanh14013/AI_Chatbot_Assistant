/**
 * ProjectCard Component
 * Displays a project with its nested conversations
 */

import React, { useState, useMemo } from "react";
import { Button, Dropdown, App, Badge } from "antd";
import type { MenuProps } from "antd";
import {
  FolderOutlined,
  DownOutlined,
  RightOutlined,
  MoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { Project } from "../types/project.type";
import type { ConversationListItem } from "../types/chat.type";
import ConversationItem from "./ConversationItem";
import { rafThrottle } from "../utils/performance.util";
import styles from "./ProjectCard.module.css";

interface ProjectCardProps {
  project: Project;
  conversations: ConversationListItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  currentConversationId?: string;
  // Drag & Drop
  onDragOver?: (projectId: string, isValid: boolean) => void;
  onDrop?: (
    projectId: string,
    conversationId: string,
    sourceProjectId: string | null
  ) => void;
  onDragLeave?: () => void;
  isDropTarget?: boolean;
  isDropTargetInvalid?: boolean;
  draggedConversationId?: string | null;
  onConversationDragStart?: (
    conversationId: string,
    projectId: string | null
  ) => void;
  onConversationDragEnd?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  conversations,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onNewConversation,
  onSelectConversation,
  currentConversationId,
  onDragOver,
  onDrop,
  onDragLeave,
  isDropTarget = false,
  isDropTargetInvalid = false,
  draggedConversationId = null,
  onConversationDragStart,
  onConversationDragEnd,
}) => {
  const { modal } = App.useApp();
  const [isHovered, setIsHovered] = useState(false);

  // Menu items for 3-dot dropdown
  const menuItems: MenuProps["items"] = [
    {
      key: "new",
      label: "New Conversation",
      icon: <PlusOutlined />,
      onClick: onNewConversation,
    },
    {
      type: "divider",
    },
    {
      key: "edit",
      label: "Edit Project",
      icon: <EditOutlined />,
      onClick: onEdit,
    },
    {
      key: "delete",
      label: "Delete Project",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        modal.confirm({
          title: "Delete Project",
          content: `Are you sure you want to delete "${project.name}"? All conversations will be moved back to Chats.`,
          okText: "Delete",
          okType: "danger",
          cancelText: "Cancel",
          onOk: onDelete,
        });
      },
    },
  ];

  // Throttle drag over to reduce performance overhead during drag
  const throttledDragOver = useMemo(
    () =>
      rafThrottle((projectId: string) => {
        if (onDragOver) {
          onDragOver(projectId, true);
        }
      }),
    [onDragOver]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Use throttled version to reduce excessive re-renders
    throttledDragOver(project.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const conversationId = e.dataTransfer.getData("conversationId");
    const sourceProjectId = e.dataTransfer.getData("projectId");

    // Convert "null" string to actual null
    const actualSourceProjectId =
      !sourceProjectId || sourceProjectId === "null" ? null : sourceProjectId;

    if (onDrop && conversationId) {
      onDrop(project.id, conversationId, actualSourceProjectId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only trigger if leaving the project card itself, not child elements
    if (
      e.currentTarget === e.target ||
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      if (onDragLeave) {
        onDragLeave();
      }
    }
  };

  return (
    <div
      className={`${styles.projectCard} ${
        isDropTarget ? styles.dragOver : ""
      } ${isDropTargetInvalid ? styles.dragOverInvalid : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Project Header */}
      <div className={styles.projectHeader}>
        <div className={styles.projectInfo} onClick={onToggle}>
          {/* Expand/Collapse Icon */}
          <span className={styles.expandIcon}>
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>

          {/* Project Icon or Folder */}
          {project.icon ? (
            <span className={styles.projectIcon}>{project.icon}</span>
          ) : (
            <FolderOutlined
              className={styles.projectIcon}
              style={{ color: project.color }}
            />
          )}

          {/* Project Name */}
          <span className={styles.projectName}>{project.name}</span>

          {/* Conversation Count Badge */}
          <Badge
            count={project.conversationCount}
            showZero
            className={styles.countBadge}
            style={{ backgroundColor: project.color }}
          />
        </div>

        {/* 3-dot Menu (shown on hover) */}
        {isHovered && (
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className={styles.menuButton}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>

      {/* Nested Conversations - Only show if has conversations */}
      {isExpanded && conversations.length > 0 && (
        <div className={styles.conversationsList}>
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              onClick={() => onSelectConversation(conv.id)}
              nested={true}
              draggable={true}
              isDragging={conv.id === draggedConversationId}
              onDragStart={onConversationDragStart}
              onDragEnd={onConversationDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
