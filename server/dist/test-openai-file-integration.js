import * as OpenAIFileService from "./services/openai-file.service.js";
import * as CloudinaryService from "./services/cloudinary.service.js";
async function testOpenAIFileIntegration() {
    try {
        OpenAIFileService.isFileSupportedByOpenAI("raw", "pdf");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "txt");
        OpenAIFileService.isFileSupportedByOpenAI("image", "jpg");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "docx");
        OpenAIFileService.isFileSupportedByOpenAI("raw", "exe");
        const signature = CloudinaryService.generateUploadSignature("test-folder");
        if (process.env.OPENAI_API_KEY) {
            try {
                const openai = (await import("./services/openai.service.js")).default;
                const files = await openai.files.list();
                if (files.data && files.data.length > 0) {
                    const firstFile = files.data[0];
                }
            }
            catch (error) { }
        }
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
testOpenAIFileIntegration()
    .then(() => {
    process.exit(0);
})
    .catch((error) => {
    process.exit(1);
});
