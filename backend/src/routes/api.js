const express = require("express");
const router = express.Router();
const topicController = require("../controllers/topicController");
const voiceController = require("../controllers/voiceController");

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
router.get("/voice/settings", voiceController.getVoiceSettings);
router.post("/voice/customize", voiceController.customizeVoice);

module.exports = router;
