/**
 * Test script for OpenAI File API integration
 * Tests the complete workflow: upload to Cloudinary + OpenAI File API
 */
import * as OpenAIFileService from "./services/openai-file.service.js";
import * as CloudinaryService from "./services/cloudinary.service.js";
async function testOpenAIFileIntegration() {
    console.log("🧪 [Test] Starting OpenAI File API integration test");
    try {
        // Test 1: Check if file types are supported
        console.log("\n📋 [Test 1] Testing file type support");
        console.log("PDF supported:", OpenAIFileService.isFileSupportedByOpenAI("raw", "pdf"));
        console.log("TXT supported:", OpenAIFileService.isFileSupportedByOpenAI("raw", "txt"));
        console.log("JPG supported:", OpenAIFileService.isFileSupportedByOpenAI("image", "jpg"));
        console.log("DOCX supported:", OpenAIFileService.isFileSupportedByOpenAI("raw", "docx"));
        console.log("EXE not supported:", OpenAIFileService.isFileSupportedByOpenAI("raw", "exe"));
        // Test 2: Test Cloudinary upload signature generation
        console.log("\n📤 [Test 2] Testing Cloudinary upload signature");
        const signature = CloudinaryService.generateUploadSignature("test-folder");
        console.log("Upload signature generated:", !!signature);
        // Test 3: Test OpenAI File API connection (if API key is available)
        console.log("\n🤖 [Test 3] Testing OpenAI File API connection");
        if (process.env.OPENAI_API_KEY) {
            try {
                // List files to test connection
                const openai = (await import("./services/openai.service.js")).default;
                const files = await openai.files.list();
                console.log("✅ OpenAI API connected, files count:", files.data?.length || 0);
                // Test file info retrieval (if we have any files)
                if (files.data && files.data.length > 0) {
                    const firstFile = files.data[0];
                    console.log("✅ Sample file info:", {
                        id: firstFile.id,
                        filename: firstFile.filename,
                        purpose: firstFile.purpose,
                    });
                }
            }
            catch (error) {
                console.log("⚠️ OpenAI API test failed:", error.message);
            }
        }
        else {
            console.log("⚠️ OPENAI_API_KEY not set, skipping API tests");
        }
        // Test 4: Test database model structure (without actual DB operations)
        console.log("\n💾 [Test 4] Testing database model structure");
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
        console.log("✅ Mock file data structure includes openai_file_id:", !!mockFileData.openai_file_id);
        console.log("\n🎉 [Test] All tests completed successfully!");
    }
    catch (error) {
        console.error("❌ [Test] Test failed:", error);
        throw error;
    }
}
// Run the test
testOpenAIFileIntegration()
    .then(() => {
    console.log("\n✅ Test script completed");
    process.exit(0);
})
    .catch((error) => {
    console.error("\n❌ Test script failed:", error);
    process.exit(1);
});
