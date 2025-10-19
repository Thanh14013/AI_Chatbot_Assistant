/**
 * ConversationForm Component
 * Form for creating a new conversation with customizable settings
 */

import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Slider,
  Typography,
  Space,
  Divider,
} from "antd";
import { MessageOutlined, SettingOutlined } from "@ant-design/icons";
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
}

/**
 * Available AI models with descriptions
 */
const AI_MODELS = [
  {
    value: "gpt-5-nano",
    label: "GPT-5 Nano",
    description:
      "Default lightweight model — fast, cost-efficient and good for everyday chats",
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
  const [form] = Form.useForm<ConversationFormValues>();
  const [contextWindow, setContextWindow] = useState(
    initialValues?.context_window || 10
  );

  // Update form and state when initialValues change (for edit mode)
  React.useEffect(() => {
    if (mode === "edit" && initialValues) {
      form.setFieldsValue(initialValues);
      setContextWindow(initialValues.context_window);
    }
  }, [mode, initialValues, form]);

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        onSubmit(values);
        if (mode === "create") {
          form.resetFields();
          setContextWindow(10); // Reset to default only for create mode
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
          model: "gpt-5-nano",
          context_window: 10,
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
      </Form>
    </Modal>
  );
};

export default ConversationForm;
