/**
 * ConversationForm Component
 * Form for creating a new conversation with customizable settings
 */

import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Slider,
  Typography,
  Space,
  Divider,
  App,
} from "antd";
import {
  MessageOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import styles from "./ConversationForm.module.css";

const { Text, Title } = Typography;
const { Option } = Select;

interface ConversationFormProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: ConversationFormValues) => void;
  loading?: boolean;
  mode?: "create" | "edit"; // Add mode prop
  initialValues?: ConversationFormValues; // Add initial values for edit mode
}

export interface ConversationFormValues {
  title: string;
  model: string;
  context_window: number;
  tags: string[];
}

/**
 * Available AI models with descriptions
 */
const AI_MODELS = [
  {
    value: "gpt-5-nano",
    label: "GPT-5 Nano",
    description:
      "Default lightweight model â€” fast, cost-efficient and good for everyday chats",
  },
  {
    value: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    description:
      "Balanced model: good mix of speed and quality for general tasks",
  },
  {
    value: "gpt-4.1-nano",
    label: "GPT-4.1 Nano",
    description:
      "Higher-quality responses for more complex reasoning and detailed answers",
  },
];

/**
 * ConversationForm component
 * Allows users to create a new conversation or edit an existing one with custom settings
 */
const ConversationForm: React.FC<ConversationFormProps> = ({
  open,
  onCancel,
  onSubmit,
  loading = false,
  mode = "create",
  initialValues,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<ConversationFormValues>();
  const [contextWindow, setContextWindow] = useState(
    initialValues?.context_window || 10
  );
  const [currentTags, setCurrentTags] = useState<string[]>([]); // Simple state array for tags

  // Update form and state when modal opens in edit mode
  React.useEffect(() => {
    if (open && mode === "edit" && initialValues) {
      // Reset form completely to clear any stale state
      form.resetFields();
      // Set fresh values
      form.setFieldsValue(initialValues);
      setContextWindow(initialValues.context_window);
      setCurrentTags(initialValues.tags || []); // Initialize tags state
    } else if (open && mode === "create") {
      // Reset form for create mode
      form.resetFields();
      setContextWindow(10);
      setCurrentTags([]); // Reset tags
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]); // Only run when modal opens/closes or mode changes - NOT when initialValues changes during editing

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        // Use currentTags state instead of form value
        values.tags = currentTags;

        onSubmit(values);
        if (mode === "create") {
          form.resetFields();
          setContextWindow(10);
          setCurrentTags([]); // Reset tags
        }
      })
      .catch((info) => {});
  };

  /**
   * Handle modal cancel
   */
  const handleCancel = () => {
    if (mode === "create") {
      form.resetFields();
      setContextWindow(10);
    }
    onCancel();
  };

  /**
   * Context window marks for slider
   */
  const contextWindowMarks = {
    5: "5",
    10: "10",
    20: "20",
    30: "30",
    50: "50",
  };

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined />
          <span>
            {mode === "create" ? "New Conversation" : "Edit Conversation"}
          </span>
        </Space>
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={mode === "create" ? "Create Conversation" : "Save Changes"}
      cancelText="Cancel"
      confirmLoading={loading}
      width={600}
      className={styles.conversationModal}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          title: "",
          model: "GPT-5 mini",
          context_window: 10,
          tags: [],
        }}
        className={styles.conversationForm}
      >
        {/* Conversation Title */}
        <Form.Item
          name="title"
          label="Conversation Title"
          rules={[
            { required: true, message: "Please enter a conversation title!" },
            {
              min: 1,
              max: 100,
              message: "Title must be between 1 and 100 characters!",
            },
          ]}
        >
          <Input
            placeholder="Enter a descriptive title for your conversation..."
            size="large"
          />
        </Form.Item>

        <Divider />

        {/* Advanced Settings */}
        <Title level={5}>
          <Space>
            <SettingOutlined />
            Advanced Settings
          </Space>
        </Title>

        {/* AI Model Selection */}
        <Form.Item
          name="model"
          label="AI Model"
          help="Choose the AI model that best fits your needs"
        >
          {/* Use optionLabelProp so the collapsed select shows only the model label (not the full JSX children) */}
          <Select
            size="large"
            placeholder="Select AI model"
            optionLabelProp="label"
          >
            {AI_MODELS.map((model) => (
              <Option key={model.value} value={model.value} label={model.label}>
                <div className={styles.modelOption}>
                  <Text strong>{model.label}</Text>
                  <br />
                  <Text type="secondary" className={styles.modelDescription}>
                    {model.description}
                  </Text>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Context Window */}
        <Form.Item
          name="context_window"
          label={`Context Window: ${contextWindow} messages`}
          help="Number of recent messages to include as context for AI responses"
        >
          <Slider
            min={5}
            max={50}
            marks={contextWindowMarks}
            step={5}
            value={contextWindow}
            onChange={(value) => {
              setContextWindow(value);
              form.setFieldsValue({ context_window: value });
            }}
            className={styles.contextSlider}
          />
        </Form.Item>

        {/* Context Window Description */}
        <div className={styles.contextDescription}>
          <Text type="secondary">
            <strong>What is Context Window?</strong>
            <br />
            The AI will remember and reference the last {contextWindow} messages
            (from both you and the AI) when generating responses. A larger
            context window helps maintain conversation flow but uses more
            tokens.
          </Text>
        </div>

        {/* Tags */}
        <Form.Item
          name="tags"
          label={
            <Space>
              <TagOutlined />
              <span>Tags</span>
            </Space>
          }
          help="Add up to 4 tags to organize your conversation (max 20 characters each)"
        >
          <Select
            mode="tags"
            size="large"
            placeholder="Add tags (e.g., work, study, personal...)"
            maxTagCount={4}
            maxTagTextLength={20}
            tokenSeparators={[","]}
            value={currentTags}
            open={false}
            onChange={(values: string[]) => {
              // Create a map to track normalized tags and preserve original casing
              const tagMap = new Map<string, string>();
              const duplicatesFound: string[] = [];

              // Process all tags, keeping the first occurrence of each normalized tag
              for (const tag of values) {
                const normalized = tag.toLowerCase().trim();
                if (!tagMap.has(normalized)) {
                  tagMap.set(normalized, tag.trim());
                } else {
                  duplicatesFound.push(tag.trim());
                }
              }

              // Convert map back to array, limited to 4 tags
              const uniqueTags = Array.from(tagMap.values()).slice(0, 4);

              // Show warning for duplicates found
              if (duplicatesFound.length > 0) {
                message.warning(
                  `Duplicate tag${
                    duplicatesFound.length > 1 ? "s" : ""
                  } removed: ${duplicatesFound.join(", ")}`
                );
              }

              setCurrentTags(uniqueTags);
            }}
            onInputKeyDown={(e) => {
              // Prevent adding duplicate tags when pressing Enter
              if (e.key === "Enter") {
                const inputElement = e.currentTarget as HTMLInputElement;
                const inputValue = inputElement.value.trim();

                if (inputValue) {
                  const normalizedInput = inputValue.toLowerCase().trim();
                  const exists = currentTags.some(
                    (tag) => tag.toLowerCase().trim() === normalizedInput
                  );

                  if (exists) {
                    message.warning(`Tag "${inputValue}" already exists!`);
                    e.preventDefault(); // Prevent the tag from being added
                    inputElement.value = ""; // Clear the input
                  }
                }
              }
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ConversationForm;
