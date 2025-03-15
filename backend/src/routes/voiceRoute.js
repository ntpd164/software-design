const express = require("express");
const router = express.Router();
const voiceController = require("../controllers/voiceController");

// Route to generate voice based on text and settings
router.post("/generate-voice", voiceController.generateVoice);

// Route to get available voice settings
router.get("/voice-settings", voiceController.getVoiceSettings);

// Route to customize voice settings
router.post("/customize-voice", voiceController.customizeVoice);

module.exports = router;
