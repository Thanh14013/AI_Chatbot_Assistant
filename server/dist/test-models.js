import User from "./models/user.model.js";
import Conversation from "./models/conversation.model.js";
import Message from "./models/message.model.js";
import connectToDatabase from "./db/database.connection.js";
async function testModels() {
    try {
        await connectToDatabase();
        let testUser = await User.findByEmail("test@example.com");
        if (!testUser) {
            return;
        }
        const conversation = await Conversation.create({
            user_id: testUser.id,
            title: "Test Conversation",
            model: "gpt-3.5-turbo",
            context_window: 10,
            tags: [],
            order_in_project: 0,
        });
        const userMessage = await Message.create({
            conversation_id: conversation.id,
            role: "user",
            content: "Hello, how are you?",
            tokens_used: 5,
            model: conversation.model,
        });
        const assistantMessage = await Message.create({
            conversation_id: conversation.id,
            role: "assistant",
            content: "I'm doing great! How can I help you today?",
            tokens_used: 10,
            model: conversation.model,
        });
        await conversation.incrementStats(userMessage.tokens_used);
        await conversation.incrementStats(assistantMessage.tokens_used);
        await conversation.reload();
        const messages = await Message.findByConversationId(conversation.id);
        const userConversations = await Conversation.findByUserId(testUser.id);
        await Conversation.softDelete(conversation.id);
        await conversation.reload();
        const activeConversations = await Conversation.findByUserId(testUser.id);
        await Message.deleteByConversation(conversation.id);
        await conversation.destroy();
    }
    catch (error) {
        throw error;
    }
}
testModels()
    .then(() => process.exit(0))
    .catch((error) => process.exit(1));
