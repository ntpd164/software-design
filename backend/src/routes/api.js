const express = require("express");
const router = express.Router();
const topicController = require("../controllers/topicController");
const voiceController = require("../controllers/voiceController");
const imageController = require("../controllers/imageController");
const videoController = require("../controllers/videoController");

// Endpoints cho trình tạo video văn học với quy trình mới
router.get("/topics/suggestions", topicController.getSuggestions);
router.get("/topics/find-works", topicController.findWorks);
router.get("/topics/check-work", topicController.checkWork);
router.post("/topics/fetch-article", topicController.fetchArticle);
router.post("/topics/generate-script", topicController.generateScriptByTopic);
router.post("/topics/save-script", topicController.saveScript);
router.get("/topics/scripts/:id", topicController.getScript);
router.put("/topics/scripts/:id", topicController.updateScript);
router.post("/topics/scripts/:id/approve", topicController.approveScript);
router.post(
  "/topics/scripts/:id/auto-adjust",
  topicController.autoAdjustScript
);
router.get("/topics/scripts", topicController.getUserScripts);

// Voice generation endpoints
router.post("/voice/generate", voiceController.generateVoice);
router.post("/voice/generate-segments", voiceController.generateVoiceSegments);
router.get("/voice/settings", voiceController.getVoiceSettings);
router.post("/voice/customize", voiceController.customizeVoice);

// Image generation endpoints with Cloudflare Flux
router.get("/images/script/:scriptId", imageController.getImagesByScript);
router.delete("/images/:id", imageController.deleteImage);
router.post("/images/generate/:scriptId", imageController.generateImageFromScript);
router.post("/images/regenerate/:scriptId", imageController.regenerateImage);
router.post("/images/upload/:scriptId", imageController.uploadReplaceImage);
router.post("/images/edit", imageController.editImage);

// Video creation endpoint
router.post("/video/create-video", videoController.createVideo);
router.get("/video/download/:filename", videoController.downloadVideo);
router.get("/videos", videoController.getAllVideos);

module.exports = router;
