/**
 * File Upload Routes
 */
import express from "express";
import * as fileUploadController from "../controllers/fileUpload.controller.js";
import { authenticateAccessToken } from "../middlewares/authJwt.js";
const router = express.Router();
// All routes require authentication
router.use(authenticateAccessToken);
// Generate presigned upload signature for client-side upload
router.post("/upload-signature", fileUploadController.generateUploadSignature);
// Save file metadata after successful upload to Cloudinary
router.post("/metadata", fileUploadController.saveFileMetadata);
// Get file by ID
router.get("/:id", fileUploadController.getFileById);
// Get files for a conversation
router.get("/conversation/:conversationId", fileUploadController.getConversationFiles);
// Delete file
router.delete("/:id", fileUploadController.deleteFile);
// Get user's upload statistics
router.get("/stats", fileUploadController.getUserStats);
export default router;
