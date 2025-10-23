/**
 * ProjectModal Component
 * Modal for creating or editing a project
 */

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, App } from "antd";
import type { Project, CreateProjectInput } from "../types/project.type";
import styles from "./ProjectModal.module.css";

interface ProjectModalProps {
  visible: boolean;
  mode: "create" | "edit";
  project?: Project;
  onSubmit: (data: CreateProjectInput) => Promise<void>;
  onCancel: () => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  visible,
  mode,
  project,
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#1890ff");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  // Predefined color palette
  const colorPalette = [
    "#1890ff", // Blue
    "#52c41a", // Green
    "#fa8c16", // Orange
    "#f5222d", // Red
    "#722ed1", // Purple
    "#13c2c2", // Cyan
    "#eb2f96", // Magenta
    "#faad14", // Gold
  ];

  // Predefined emoji icons
  const iconOptions = [
    "📁",
    "💼",
    "🎯",
    "🚀",
    "💡",
    "📊",
    "🎨",
    "🔬",
    "📚",
    "🏆",
    "⚡",
    "🌟",
  ];

  // Initialize form with project data when editing
  useEffect(() => {
    if (visible && mode === "edit" && project) {
      form.setFieldsValue({
        name: project.name,
        description: project.description || "",
      });
      setSelectedColor(project.color);
      setSelectedIcon(project.icon);
    } else if (visible && mode === "create") {
      form.resetFields();
      setSelectedColor("#1890ff");
      setSelectedIcon(null);
    }
  }, [visible, mode, project, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await onSubmit({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: selectedColor,
        icon: selectedIcon || undefined,
      });

      message.success(
        mode === "create"
          ? "Project created successfully"
          : "Project updated successfully"
      );
      form.resetFields();
      setSelectedColor("#1890ff");
      setSelectedIcon(null);
    } catch (error: any) {
      message.error(error.message || `Failed to ${mode} project`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedColor("#1890ff");
    setSelectedIcon(null);
    onCancel();
  };

  return (
    <Modal
      title={mode === "create" ? "Create New Project" : "Edit Project"}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={mode === "create" ? "Create" : "Save"}
      cancelText="Cancel"
      confirmLoading={loading}
      width={500}
      className={styles.projectModal}
    >
      <Form form={form} layout="vertical" className={styles.form}>
        <Form.Item
          name="name"
          label="Project Name"
          rules={[
            { required: true, message: "Please enter project name" },
            {
              max: 255,
              message: "Project name must be less than 255 characters",
            },
          ]}
        >
          <Input placeholder="Enter project name" maxLength={255} />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea
            placeholder="Enter project description (optional)"
            rows={3}
            maxLength={500}
          />
        </Form.Item>

        <Form.Item label="Color">
          <div className={styles.colorPicker}>
            {colorPalette.map((color) => (
              <div
                key={color}
                className={`${styles.colorOption} ${
                  selectedColor === color ? styles.selected : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </Form.Item>

        <Form.Item label="Icon (Optional)">
          <div className={styles.iconPicker}>
            <div
              className={`${styles.iconOption} ${
                selectedIcon === null ? styles.selected : ""
              }`}
              onClick={() => setSelectedIcon(null)}
            >
              None
            </div>
            {iconOptions.map((icon) => (
              <div
                key={icon}
                className={`${styles.iconOption} ${
                  selectedIcon === icon ? styles.selected : ""
                }`}
                onClick={() => setSelectedIcon(icon)}
              >
                {icon}
              </div>
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectModal;
