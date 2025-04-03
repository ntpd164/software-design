const { MongoClient, ObjectId } = require("mongodb");
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require("path");
const fs = require("fs");
const Video = require('../models/videoModel');

const uri = "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";

// Directory for storing generated videos
const VIDEO_DIR = path.join(__dirname, "../../public/videos");
const TEMP_DIR = path.join(__dirname, "../../public/temp");

// Ensure the directories exist
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Helper function to safely delete a file
const safeDeleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`Warning: Could not delete file ${filePath}:`, error.message);
  }
};

// Helper function to clean up temp files
const cleanupTempFiles = (files) => {
  files.forEach(file => {
    safeDeleteFile(file);
  });
};

/**
 * Create a video from images in a script
 * @param {string} scriptId - The ID of the script containing the images
 * @returns {Promise<Object>} - Object containing video URL and duration
 */
const createVideo = async (scriptId) => {
  let tempImages = [];
  let fileListPath = '';
  let mongoClient = null;

  try {
    // Connect to MongoDB
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    // Get the script with its images
    const script = await scriptsCollection.findOne({
      _id: new ObjectId(scriptId)
    });

    if (!script || !script.images || script.images.length === 0) {
      throw new Error("No images found for this script");
    }

    // Sort images by index
    const sortedImages = script.images.sort((a, b) => a.index - b.index);

    // Create a unique filename for the video
    const videoFilename = `${Date.now()}-${scriptId}.mp4`;
    const videoPath = path.join(VIDEO_DIR, videoFilename);

    // Process and save each image to temp directory
    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];
      const tempImagePath = path.join(TEMP_DIR, `frame-${i}.png`);
      
      // Process image with sharp
      await sharp(path.join(__dirname, "../../public", image.imageUrl))
        .resize(1920, 1080, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .toFile(tempImagePath);
      
      tempImages.push(tempImagePath);
    }

    // Create video using ffmpeg
    const duration = await new Promise((resolve, reject) => {
      let totalDuration = 0;
      
      // Create a file list for ffmpeg
      fileListPath = path.join(TEMP_DIR, 'filelist.txt');
      const fileListContent = tempImages
        .map(img => `file '${img}'\nduration 3.0`)
        .join('\n');
      fs.writeFileSync(fileListPath, fileListContent);

      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30',
          '-preset medium',
          '-crf 23'
        ])
        .output(videoPath)
        .on('end', () => {
          resolve(totalDuration);
        })
        .on('error', (err) => {
          reject(err);
        })
        .on('progress', (progress) => {
          totalDuration = progress.timemark;
        })
        .run();
    });

    // Update the script with the video object
    const videoUrl = `/videos/${videoFilename}`;
    const videoObject = {
      url: videoUrl,
      duration: duration.toString(),
      createdAt: new Date()
    };

    // Save to videos collection
    const video = new Video({
      scriptId: scriptId,
      videoUrl: videoUrl,
      duration: duration.toString(),
      createdAt: new Date()
    });
    await video.save();

    // Update script with video information
    await scriptsCollection.updateOne(
      { _id: new ObjectId(scriptId) },
      { $set: { video: videoObject } }
    );

    return {
      success: true,
      video: videoObject
    };
  } catch (error) {
    console.error("Error in video service:", error);
    throw error;
  } finally {
    // Clean up temp files after a short delay to ensure ffmpeg has released them
    setTimeout(() => {
      cleanupTempFiles(tempImages);
      safeDeleteFile(fileListPath);
    }, 1000);
    
    // Close MongoDB connection if it was opened
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (error) {
        console.error("Error closing MongoDB connection:", error);
      }
    }
  }
};

module.exports = {
  createVideo
};
