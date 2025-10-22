import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../db/database.config.js";
import type { IMessage } from "../types/message.type.js";

// Define Message attributes (excluding timestamp which is auto-managed)
type MessageAttributes = Omit<IMessage, "createdAt"> & {
  createdAt?: Date;
};

// Define creation attributes (fields that can be omitted when creating a new message)
// id, createdAt, tokens_used, model, pinned are auto-generated or have defaults
type MessageCreationAttributes = Optional<
  MessageAttributes,
  "id" | "createdAt" | "tokens_used" | "model" | "pinned"
>;

/**
 * Message Model Class
 * Represents a single message in a conversation
 * Can be from user, assistant (AI), or system
 * Extends Sequelize Model with custom methods for message management
 */
class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  // Model properties
  public id!: string;
  public conversation_id!: string;
  public role!: "user" | "assistant" | "system";
  public content!: string;
  public tokens_used!: number;
  public model!: string;
  public pinned!: boolean;

  // Timestamp (automatically managed by Sequelize)
  public readonly createdAt!: Date;

  /**
   * Find all messages for a specific conversation
   * @param conversationId - The conversation's ID
   * @param limit - Optional limit for number of messages
   * @returns Promise with array of messages ordered by creation time
   */
  public static async findByConversationId(
    conversationId: string,
    limit?: number
  ): Promise<Message[]> {
    return Message.findAll({
      where: { conversation_id: conversationId },
      order: [["createdAt", "ASC"]], // Oldest first (chronological order)
      limit: limit || undefined,
    });
  }

  /**
   * Find the last N messages for a conversation (for context window)
   * @param conversationId - The conversation's ID
   * @param limit - Number of recent messages to retrieve
   * @returns Promise with array of recent messages in chronological order
   */
  public static async findRecentMessages(
    conversationId: string,
    limit: number
  ): Promise<Message[]> {
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [["createdAt", "DESC"]], // Most recent first
      limit: limit,
    });

    // Reverse to get chronological order (oldest to newest)
    return messages.reverse();
  }

  /**
   * Count total messages in a conversation
   * @param conversationId - The conversation's ID
   * @returns Promise with message count
   */
  public static async countByConversation(conversationId: string): Promise<number> {
    return Message.count({
      where: { conversation_id: conversationId },
    });
  }

  /**
   * Delete all messages for a conversation (cascade delete)
   * @param conversationId - The conversation's ID
   * @returns Promise with number of deleted messages
   */
  public static async deleteByConversation(conversationId: string): Promise<number> {
    return Message.destroy({
      where: { conversation_id: conversationId },
    });
  }

  /**
   * Pin a message
   * @param messageId - The message's ID
   * @returns Promise with updated message
   */
  public static async pinMessage(messageId: string): Promise<Message> {
    const message = await Message.findByPk(messageId);
    if (!message) {
      console.error(`❌ [MESSAGE_MODEL] Message not found: ${messageId}`);
      throw new Error("Message not found");
    }

    message.pinned = true;
    await message.save();

    return message;
  }

  /**
   * Unpin a message
   * @param messageId - The message's ID
   * @returns Promise with updated message
   */
  public static async unpinMessage(messageId: string): Promise<Message> {
    const message = await Message.findByPk(messageId);
    if (!message) {
      console.error(`❌ [MESSAGE_MODEL] Message not found: ${messageId}`);
      throw new Error("Message not found");
    }

    message.pinned = false;
    await message.save();

    return message;
  }

  /**
   * Get all pinned messages for a conversation
   * @param conversationId - The conversation's ID
   * @returns Promise with array of pinned messages
   */
  public static async findPinnedMessages(conversationId: string): Promise<Message[]> {
    const messages = await Message.findAll({
      where: {
        conversation_id: conversationId,
        pinned: true,
      },
      order: [["createdAt", "DESC"]], // Most recent first
    });

    return messages;
  }

  /**
   * Count pinned messages in a conversation
   * @param conversationId - The conversation's ID
   * @returns Promise with pinned message count
   */
  public static async countPinnedByConversation(conversationId: string): Promise<number> {
    const count = await Message.count({
      where: {
        conversation_id: conversationId,
        pinned: true,
      },
    });

    return count;
  }
}

// Initialize Message model with schema definition
Message.init(
  {
    // Primary key - UUID type
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Auto-generated UUID
      primaryKey: true,
      comment: "Unique identifier for the message",
    },

    // Foreign key to conversations table
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "conversations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      comment: "Conversation ID (foreign key to conversations table)",
    },

    // Message role (user, assistant, or system)
    role: {
      type: DataTypes.ENUM("user", "assistant", "system"),
      allowNull: false,
      comment: "Role of the message sender (user, assistant, or system)",
    },

    // Message content/text
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Message content/text",
    },

    // Number of tokens used in this message
    tokens_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of tokens consumed by this message",
    },

    // AI model used for this message
    model: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "gpt-3.5-turbo",
      comment: "AI model used for this message",
    },

    // Whether the message is pinned
    pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the message is pinned for quick reference",
    },
  },
  {
    sequelize, // Database connection instance
    tableName: "messages",
    modelName: "Message",
    timestamps: true, // Enable createdAt
    updatedAt: false, // Messages don't need updatedAt (immutable)
    indexes: [
      // Indexes for performance optimization
      { fields: ["conversation_id"] }, // Index for finding conversation's messages
      { fields: ["conversation_id", "createdAt"] }, // Composite index for chronological queries
      { fields: ["createdAt"] }, // Index for sorting by creation date
      { fields: ["role"] }, // Index for filtering by role
      { fields: ["conversation_id", "pinned", "createdAt"] }, // Index for pinned messages queries
    ],
  }
);

export default Message;
