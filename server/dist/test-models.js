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
    console.log("🧪 Testing Conversation and Message Models...\n");
    try {
        // Connect to database
        await connectToDatabase();
        // Find or create a test user
        let testUser = await User.findByEmail("test@example.com");
        if (!testUser) {
            console.log("❌ Test user not found. Please register test@example.com first.");
            return;
        }
        console.log(`✅ Found test user: ${testUser.name} (${testUser.email})`);
        // Create a new conversation
        console.log("\n📝 Creating a new conversation...");
        const conversation = await Conversation.create({
            user_id: testUser.id,
            title: "Test Conversation",
            model: "gpt-3.5-turbo",
            context_window: 10,
        });
        console.log(`✅ Created conversation: ${conversation.id}`);
        console.log(`   Title: ${conversation.title}`);
        console.log(`   Model: ${conversation.model}`);
        console.log(`   Context Window: ${conversation.context_window}`);
        // Add a user message
        console.log("\n💬 Adding user message...");
        const userMessage = await Message.create({
            conversation_id: conversation.id,
            role: "user",
            content: "Hello, how are you?",
            tokens_used: 5,
            model: conversation.model,
        });
        console.log(`✅ Created user message: ${userMessage.id}`);
        console.log(`   Content: "${userMessage.content}"`);
        // Add an assistant message
        console.log("\n🤖 Adding assistant message...");
        const assistantMessage = await Message.create({
            conversation_id: conversation.id,
            role: "assistant",
            content: "I'm doing great! How can I help you today?",
            tokens_used: 10,
            model: conversation.model,
        });
        console.log(`✅ Created assistant message: ${assistantMessage.id}`);
        console.log(`   Content: "${assistantMessage.content}"`);
        // Update conversation stats
        console.log("\n📊 Updating conversation stats...");
        await conversation.incrementStats(userMessage.tokens_used);
        await conversation.incrementStats(assistantMessage.tokens_used);
        await conversation.reload();
        console.log(`✅ Updated conversation stats:`);
        console.log(`   Message Count: ${conversation.message_count}`);
        console.log(`   Total Tokens Used: ${conversation.total_tokens_used}`);
        // Retrieve all messages for the conversation
        console.log("\n📋 Retrieving all messages...");
        const messages = await Message.findByConversationId(conversation.id);
        console.log(`✅ Found ${messages.length} messages:`);
        messages.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
        });
        // Retrieve user's conversations
        console.log("\n📚 Retrieving user's conversations...");
        const userConversations = await Conversation.findByUserId(testUser.id);
        console.log(`✅ Found ${userConversations.length} conversation(s) for user`);
        // Test soft delete
        console.log("\n🗑️  Testing soft delete...");
        await Conversation.softDelete(conversation.id);
        await conversation.reload();
        console.log(`✅ Soft deleted conversation`);
        console.log(`   Deleted At: ${conversation.deleted_at}`);
        // Verify soft delete works
        const activeConversations = await Conversation.findByUserId(testUser.id);
        console.log(`✅ Active conversations after delete: ${activeConversations.length}`);
        // Clean up - hard delete the test conversation
        console.log("\n🧹 Cleaning up test data...");
        await Message.deleteByConversation(conversation.id);
        await conversation.destroy();
        console.log("✅ Test data cleaned up successfully");
        console.log("\n✨ All tests passed! Models are working correctly.\n");
    }
    catch (error) {
        console.error("\n❌ Test failed:", error);
        throw error;
    }
}
// Run tests
testModels()
    .then(() => {
    console.log("✅ Test completed successfully");
    process.exit(0);
})
    .catch((error) => {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
});
