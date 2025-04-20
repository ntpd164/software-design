const { MongoClient, ObjectId } = require("mongodb");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const Video = require("../models/videoModel");
const geminiService = require("./geminiService");
const { v4: uuidv4 } = require("uuid");

const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";

// Directory for storing generated videos
const VIDEO_DIR = path.join(__dirname, "../../public/videos");
const TEMP_DIR = path.join(__dirname, "../../public/temp");
const AUDIO_DIR = path.join(__dirname, "../../public/audio");

// Ensure the directories exist
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
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
  files.forEach((file) => {
    safeDeleteFile(file);
  });
};

/**
 * Get audio duration in seconds using ffprobe
 */
const getAudioDuration = (audioPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        console.error("Error getting audio duration:", err);
        // Default to 3 seconds if we can't get duration
        resolve(3);
        return;
      }

      if (metadata && metadata.format && metadata.format.duration) {
        resolve(parseFloat(metadata.format.duration));
      } else {
        // Default to 3 seconds if duration is not available
        resolve(3);
      }
    });
  });
};

/**
 * Create a video from images in a script, with audio if available
 * @param {string} scriptId - The ID of the script containing the images
 * @returns {Promise<Object>} - Object containing video URL and duration
 */
const createVideo = async (scriptId, withAudio = true) => {
  let tempImages = [];
  let tempSegments = [];
  let mongoClient = null;
  const tempDir = path.join(TEMP_DIR, `video_${scriptId}_${Date.now()}`);

  try {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Connect to MongoDB and get script data
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const script = await scriptsCollection.findOne({
      _id: new ObjectId(scriptId),
    });

    if (!script || !script.images || script.images.length === 0) {
      throw new Error("No images found for this script");
    }

    // Sort images by index
    const sortedImages = [...script.images].sort((a, b) => a.index - b.index);

    // Create a unique filename for the video
    const videoFilename = `${Date.now()}-${scriptId}.mp4`;
    const videoPath = path.join(VIDEO_DIR, videoFilename);

    // Create a file for concatenation
    const concatFilePath = path.join(tempDir, "concat.txt");
    let concatFileContent = "";
    let totalDuration = 0;

    console.log(
      `Processing ${sortedImages.length} images for video, withAudio=${withAudio}`
    );

    // Process each image with its associated audio
    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];

      // Get image URL from the image object
      const imageUrl = image.imageUrl || image.url;
      if (!imageUrl) {
        console.warn(
          `No image URL found for image at index ${
            image.index || i
          }, skipping...`
        );
        continue;
      }

      // Create temp path for processed image
      const tempImagePath = path.join(tempDir, `image_${i}.png`);

      try {
        // Convert relative image path to absolute
        const imagePath = path.join(__dirname, "../../public", imageUrl);
        console.log(`Processing image from ${imagePath} to ${tempImagePath}`);

        await sharp(imagePath)
          .resize(1920, 1080, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          })
          .toFile(tempImagePath);

        tempImages.push(tempImagePath);
      } catch (imgError) {
        console.error(`Error processing image ${imageUrl}:`, imgError);
        continue; // Skip this image if it fails
      }

      // Path to the segment video
      const segmentPath = path.join(tempDir, `segment_${i}.mp4`);
      tempSegments.push(segmentPath);

      // Default duration if no audio
      let segmentDuration = 5; // Increased default duration

      // Check if we should include audio and if this image has audioUrl
      let audioPath = null;
      let hasAudio = false;

      if (withAudio && image.audioUrl) {
        audioPath = path.join(__dirname, "../../public", image.audioUrl);
        console.log(`Checking audio file: ${audioPath}`);

        // Check if the audio file exists
        if (fs.existsSync(audioPath)) {
          hasAudio = true;
          const stats = fs.statSync(audioPath);
          console.log(
            `Found audio file: ${audioPath}, size: ${stats.size} bytes`
          );

          if (stats.size === 0) {
            console.warn(`Audio file exists but is empty: ${audioPath}`);
            hasAudio = false;
          }
        } else {
          console.warn(`Audio file not found: ${audioPath}`);
        }
      }

      try {
        if (hasAudio) {
          // Get audio duration
          try {
            // Get audio duration using ffprobe
            const duration = await new Promise((resolve, reject) => {
              ffmpeg.ffprobe(audioPath, (err, metadata) => {
                if (err) {
                  console.error(`Failed to get audio duration: ${err.message}`);
                  reject(err);
                  return;
                }

                if (metadata && metadata.format && metadata.format.duration) {
                  resolve(metadata.format.duration);
                } else {
                  resolve(5); // Default to 5 seconds
                }
              });
            });

            segmentDuration = duration;
            console.log(`Audio duration for segment ${i}: ${segmentDuration}s`);
          } catch (durationErr) {
            console.error(
              `Error getting audio duration: ${durationErr.message}`
            );
          }

          // Create segment with audio
          console.log(`Creating segment ${i} with audio from ${audioPath}`);

          await new Promise((resolve, reject) => {
            ffmpeg()
              .input(tempImagePath)
              .inputOptions(["-loop 1"])
              .input(audioPath)
              .outputOptions([
                "-c:v libx264",
                "-tune stillimage",
                "-c:a aac",
                "-b:a 192k",
                "-pix_fmt yuv420p",
                "-shortest",
              ])
              .on("start", (cmd) => {})
              .on("end", () => {
                resolve();
              })
              .on("error", (err) => {
                reject(err);
              })
              .save(segmentPath);
          });
        } else {
          await new Promise((resolve, reject) => {
            ffmpeg()
              .input(tempImagePath)
              .inputOptions(["-loop 1"])
              .outputOptions([
                "-c:v libx264",
                "-t",
                segmentDuration.toString(),
                "-pix_fmt yuv420p",
                "-an", // No audio
              ])
              .on("end", resolve)
              .on("error", (err) => {
                console.error(`Error creating silent segment ${i}:`, err);
                reject(err);
              })
              .save(segmentPath);
          });
        }

        // Add to concat file and total duration
        concatFileContent += `file '${segmentPath.replace(/\\/g, "/")}'\n`;
        totalDuration += segmentDuration;
      } catch (segErr) {
        console.error(`Error processing segment ${i}:`, segErr);
      }
    }

    if (concatFileContent === "") {
      throw new Error("No valid segments were created");
    }

    // Write the concat file
    fs.writeFileSync(concatFilePath, concatFileContent);
    console.log(`Created concat file with ${sortedImages.length} segments`);

    // Create the final video
    await new Promise((resolve, reject) => {
      console.log(
        `Joining video segments using concat file: ${concatFilePath}`
      );

      ffmpeg()
        .input(concatFilePath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy", "-movflags +faststart"])
        .on("start", (cmd) => console.log(`FFMPEG concat command: ${cmd}`))
        .on("progress", (progress) => {
          console.log(`Processing: ${Math.floor(progress.percent)}% done`);
        })
        .on("end", () => {
          console.log(`Final video created successfully: ${videoPath}`);
          resolve();
        })
        .on("error", (err) => {
          console.error("Error creating final video:", err);
          reject(err);
        })
        .save(videoPath);
    });

    // Update the script with the video object
    const videoUrl = `/videos/${videoFilename}`;
    const videoObject = {
      url: videoUrl,
      duration: Math.round(totalDuration),
      createdAt: new Date(),
    };
    const title = await geminiService.extractScriptTitle(script.content);

    try {
      const video = new Video({
        scriptId: scriptId,
        videoUrl: videoUrl,
        title: title || "Untitled Video",
        duration: Math.round(totalDuration),
        createdAt: new Date(),
      });
      await video.save();
    } catch (err) {
      console.warn(
        "Warning: Could not save to videos collection:",
        err.message
      );
    }

    // Update script with video information
    await scriptsCollection.updateOne(
      { _id: new ObjectId(scriptId) },
      { $set: { video: videoObject } }
    );

    return {
      success: true,
      video: videoObject,
    };
  } catch (error) {
    console.error("Error in video service:", error);
    throw error;
  } finally {
    // Clean up temp files after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error("Error cleaning up temp directory:", err);
      }
    }, 5000);

    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (err) {}
    }
  }
};

/**
 * Get all videos with pagination
 * @param {Object} options - Pagination options
 * @param {number} options.limit - Number of records to fetch
 * @param {number} options.skip - Number of records to skip
 * @returns {Promise<Object>} - Object containing videos and pagination info
 */
const getAllVideos = async (options = {}) => {
  const { limit = 20, skip = 0 } = options;
  
  try {
    const videos = await Video.find()
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .populate('scriptId', 'topic')
      .lean();
      
    const totalCount = await Video.countDocuments();
    
    return {
      success: true,
      videos,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        skip: Number(skip)
      }
    };
  } catch (error) {
    console.error("Error fetching videos:", error);
    throw error;
  }
};

module.exports = {
  createVideo,
  getAllVideos,
};

