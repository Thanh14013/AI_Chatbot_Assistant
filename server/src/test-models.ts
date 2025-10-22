/**
 * Test Script: Verify Conversation and Message Models
 *
 * This script demonstrates how to use the new Conversation and Message models
 * Run with: node --no-warnings --loader ts-node/esm src/test-models.ts
 */

import User from "./models/user.model.js";
import Conversation from "./models/conversation.model.js";
import Message from "./models/message.model.js";
import connectToDatabase from "./db/database.connection.js";

async function testModels() {
  // test script

  try {
    // Connect to database
    await connectToDatabase();

    // Find or create a test user
    let testUser = await User.findByEmail("test@example.com");
    if (!testUser) {
      return;
    }

    // Create a new conversation
    // creating a new conversation
    const conversation = await Conversation.create({
      user_id: testUser.id,
      title: "Test Conversation",
      model: "gpt-3.5-turbo",
      context_window: 10,
      tags: [], // Add required tags field
    });
    // created conversation

    // Add a user message
    // adding user message
    const userMessage = await Message.create({
      conversation_id: conversation.id,
      role: "user",
      content: "Hello, how are you?",
      tokens_used: 5,
      model: conversation.model,
    });
    // created user message

    // Add an assistant message
    // adding assistant message
    const assistantMessage = await Message.create({
      conversation_id: conversation.id,
      role: "assistant",
      content: "I'm doing great! How can I help you today?",
      tokens_used: 10,
      model: conversation.model,
    });
    // created assistant message

    // Update conversation stats
    // updating conversation stats
    await conversation.incrementStats(userMessage.tokens_used);
    await conversation.incrementStats(assistantMessage.tokens_used);
    await conversation.reload();
    // updated conversation stats

    // Retrieve all messages for the conversation
    const messages = await Message.findByConversationId(conversation.id);

    // Retrieve user's conversations
    const userConversations = await Conversation.findByUserId(testUser.id);

    // Test soft delete
    // testing soft delete
    await Conversation.softDelete(conversation.id);
    await conversation.reload();
    // soft deleted conversation

    // Verify soft delete works
    const activeConversations = await Conversation.findByUserId(testUser.id);
    // active conversations after delete

    // Clean up - hard delete the test conversation
    // cleaning up test data
    await Message.deleteByConversation(conversation.id);
    await conversation.destroy();
    // test data cleaned up

    // all tests passed
  } catch (error) {
    throw error;
  }
}

// Run tests
testModels()
  .then(() => process.exit(0))
  .catch((error) => process.exit(1));
