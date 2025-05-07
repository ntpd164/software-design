const videoService = require("../services/videoService");
const path = require("path");
const fs = require("fs");

/**
 * Create a video from images in a script
 * @param {Object} req - Request object with scriptId
 * @param {Object} res - Response object
 */
exports.createVideo = async (req, res) => {
  try {
    const { scriptId, withAudio = true } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        success: false,
        message: "Script ID is required",
      });
    }

    console.log(`Creating video for script ${scriptId} ${withAudio ? 'with' : 'without'} audio`);

    const result = await videoService.createVideo(scriptId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in video controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create video",
    });
  }
};

exports.downloadVideo = async (req, res) => {
  try {
    const { filename } = req.params;
    const videoPath = path.join(__dirname, "../../public/videos", filename);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Stream the file
    const fileStream = fs.createReadStream(videoPath);
    fileStream.pipe(res);

    // Handle errors
    fileStream.on('error', (error) => {
      console.error("Error streaming video:", error);
      res.status(500).json({ success: false, message: "Error downloading video" });
    });
  } catch (error) {
    console.error("Error downloading video:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all videos with pagination
 * @param {Object} req - Request object with query parameters
 * @param {Object} res - Response object
 */
exports.getAllVideos = async (req, res) => {
  try {
    const { limit, skip } = req.query;
    
    const result = await videoService.getAllVideos({ limit, skip });
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting videos:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve videos"
    });
  }
};
