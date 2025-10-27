/**
 * Test script for OpenAI File API integration
 * Tests the complete workflow: upload to Cloudinary + OpenAI File API
 */
import * as OpenAIFileService from "./services/openai-file.service.js";
import * as CloudinaryService from "./services/cloudinary.service.js";
async function testOpenAIFileIntegration() {
    try {
        // Test 1: Check if file types are supported
        OpenAIFileService.isFileSupportedByOpenAI("raw", "pdf");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "txt");
        OpenAIFileService.isFileSupportedByOpenAI("image", "jpg");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "docx");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "exe");
        // Test 2: Test Cloudinary upload signature generation
        const signature = CloudinaryService.generateUploadSignature("test-folder");
        // Test 3: Test OpenAI File API connection (if API key is available)
        if (process.env.OPENAI_API_KEY) {
            try {
                // List files to test connection
                const openai = (await import("./services/openai.service.js")).default;
                const files = await openai.files.list();
                // Test file info retrieval (if we have any files)
                if (files.data && files.data.length > 0) {
                    const firstFile = files.data[0];
                }
            }
            catch (error) { }
        }
        // Test 4: Test database model structure (without actual DB operations)
        const mockFileData = {
            public_id: "test_file_123",
            secure_url: "https://res.cloudinary.com/test/test_file_123.pdf",
            resource_type: "raw",
            format: "pdf",
            original_filename: "test_document.pdf",
            size_bytes: 1024000,
            uploaded_by: "550e8400-e29b-41d4-a716-446655440000",
            conversation_id: "550e8400-e29b-41d4-a716-446655440001",
            status: "uploaded",
            openai_file_id: "file-test123",
        };
    }
    catch (error) {
        throw error;
    }
}
// Run the test
testOpenAIFileIntegration()
    .then(() => {
    process.exit(0);
})
    .catch((error) => {
    process.exit(1);
});
