const express = require('express');
const youtubeController = require('../controllers/youtubeController');

const router = express.Router();

// Get YouTube authorization URL
router.get('/auth-url', youtubeController.getAuthUrl);

// Handle authorization code
router.post('/auth-code', youtubeController.handleAuthCode);

// Upload video to YouTube
router.post('/upload', youtubeController.uploadVideo);

module.exports = router;