const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const {
  generateImage,
  deleteImage,
  parseImageDescriptions,
  replaceImage
} = require("../services/imageService");
const { getImageScript } = require("../services/geminiService");
const Image = require("../models/imageModel");
const Script = require("../models/scriptModel");
const { MongoClient, ObjectId } = require("mongodb");

// Directory for storing generated images
const IMAGE_DIR = path.join(__dirname, "../../public/images");

const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

// Ensure the image directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), "public/images");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Keep original filename but make it unique
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit to 10MB
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      return cb(new Error("Only .jpg, .jpeg, and .png files are allowed"));
    }
    cb(null, true);
  },
})

/**
 * Generate an image based on a prompt and add to database
 * @param {Object} req - Request object with prompt and scriptId
 * @param {Object} res - Response object
 */
exports.generateImage = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid request format. Please send a valid JSON object.",
      });
    }

    const { prompt, scriptId } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required for image generation",
      });
    }

    // Generate the image using the service
    const result = await generateImage(prompt, scriptId);

    if (scriptId) {
      try {
        await client.connect();
        const database = client.db(dbName);

        // Use $push to add to the images array instead of $set which overwrites
        await database.collection("topic_scripts").updateOne(
          { _id: new ObjectId(scriptId) },
          {
            $push: {
              images: {
                imageUrl: result.relativeImagePath,
                prompt: prompt,
                createdAt: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("Error updating script with image:", error);
      } finally {
        await client.close();
      }
    }

    // Create a new image document in MongoDB using Mongoose
    const newImage = new Image({
      scriptId,
      prompt,
      imageUrl: result.relativeImagePath,
      metadata: {
        model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        num_inference_steps: 20,
      },
    });

    await newImage.save();

    res.status(200).json({
      success: true,
      data: {
        imageUrl: result.relativeImagePath,
        _id: newImage._id,
      },
      message: "Image generated successfully",
    });
  } catch (error) {
    console.error("Error in image generation controller:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error in image generation",
    });
  }
};

/**
 * Get all images associated with a script
 * @param {Object} req - Request object with scriptId as param
 * @param {Object} res - Response object
 */
exports.getImagesByScript = async (req, res) => {
  try {
    const { scriptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(scriptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid script ID format",
      });
    }

    // Find all images with the given scriptId
    const images = await Image.find({ scriptId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: images,
      message: "Images retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching images:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch images",
    });
  }
};

/**
 * Extract image descriptions from a script and generate images sequentially
 * @param {Object} req - Request object with scriptId
 * @param {Object} res - Response object
 */
exports.generateImageFromScript = async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { style } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(scriptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid script ID format",
      });
    }

    // Extract image descriptions from the script
    const scriptContent = await getImageScript(scriptId);
    
    // Parse the returned text to extract individual image descriptions
    const imageDescriptions = parseImageDescriptions(scriptContent);
    
    if (!imageDescriptions || imageDescriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image descriptions found in the script",
      });
    }
  
    // Array to track results
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Generate images sequentially and wait for completion
    for (let i = 0; i < imageDescriptions.length; i++) {
      const prompt = imageDescriptions[i];
      console.log(`Generating image ${i+1}/${imageDescriptions.length}: "${prompt.substring(0, 50)}..."`);
      
      try {
        // Generate the image using the service directly
        const result = await generateImage(prompt, scriptId, style);
        
        // Create a new image document in MongoDB using Mongoose
        const newImage = new Image({
          scriptId,
          prompt,
          imageUrl: result.relativeImagePath,
          metadata: {
            model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
            num_inference_steps: 20,
            index: i,
            total: imageDescriptions.length
          },
        });
        
        await newImage.save();
        
        // Update the script's images array
        await client.connect();
        const database = client.db(dbName);
        
        await database.collection("topic_scripts").updateOne(
          { _id: new ObjectId(scriptId) },
          {
            $push: {
              images: {
                imageUrl: result.relativeImagePath,
                prompt: prompt,
                createdAt: new Date(),
                _id: newImage._id,
              },
            },
          }
        );
        
        await client.close();
        
        successCount++;
        results.push({
          success: true,
          imageUrl: result.relativeImagePath,
          _id: newImage._id,
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : "")
        });
        
        console.log(`✓ Successfully generated image ${i+1}/${imageDescriptions.length}\n`);
      } catch (error) {
        failCount++;
        console.error(`× Failed to generate image ${i+1}/${imageDescriptions.length}:`, error);
        
        results.push({
          success: false,
          error: error.message,
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : "")
        });
      }
      
      // Wait 1 second between requests to avoid rate limiting
      if (i < imageDescriptions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // After all images are processed, send the complete response
    return res.status(200).json({
      success: true,
      message: `Generated ${successCount} images from script (${failCount} failed)`,
      data: {
        scriptId,
        totalProcessed: imageDescriptions.length,
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    console.error("Error in image generation from script:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate images from script",
    });
  }
};

exports.regenerateImage = async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { imageId, prompt, style } = req.body;

    if (!scriptId || !imageId || !prompt) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Find the original image
    const originalImage = await Image.findById(imageId);

    if (!originalImage) {
      return res.status(404).json({
        success: false,
        message: "Original image not found",
      });
    }

    // Generate a completely new image
    const result = await generateImage(prompt, scriptId, style);

    if (!result) {
      throw new Error("Failed to generate new image");
    }

    try {
      // Connect to MongoDB
      await client.connect();

      // Use the reusable replaceImage function
      const replacementResult = await replaceImage(
        originalImage,
        result.relativeImagePath,
        scriptId,
        client
      );

      res.status(200).json({
        success: true,
        message: `Image regenerated successfully using ${replacementResult.result.method} method`,
        data: replacementResult.updatedImage,
      });
    } finally {
      if (client) {
        await client.close();
      }
    }
  } catch (error) {
    console.error("Error regenerating image:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to regenerate image",
    });
  }
};

/**
 * Replace an image with an uploaded file
 */
exports.uploadReplaceImage = async (req, res) => {
  try {
    // Use multer middleware for single file upload
    upload.single('image')(req, res, async function(err) {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { scriptId } = req.params;
      const { imageId } = req.body;

      if (!scriptId || !imageId) {
        // Remove uploaded file if params are missing
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Missing scriptId or imageId'
        });
      }

      // Find the original image
      const originalImage = await Image.findById(imageId);
      if (!originalImage) {
        // Remove uploaded file if original image not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Original image not found'
        });
      }

      // Store relative path for database
      const relativePath = `/images/${path.basename(req.file.path)}`;

      try {
        // Connect to MongoDB
        await client.connect();
        
        // Use the reusable replaceImage function
        const replacementResult = await replaceImage(
          originalImage, 
          relativePath,
          scriptId,
          client
        );
        
        return res.status(200).json({
          success: true,
          message: `Image replaced successfully using ${replacementResult.result.method} method`,
          data: replacementResult.updatedImage
        });
      } catch (error) {
        console.error('Error replacing image:', error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Failed to replace image'
        });
      } finally {
        if (client) await client.close();
      }
    });
  } catch (error) {
    console.error('Error in upload controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process upload'
    });
  }
};

/**
 * Delete an image by ID
 * @param {Object} req - Request object with image id as param
 * @param {Object} res - Response object
 */
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image ID format",
      });
    }

    // Find the image document
    const image = await Image.findById(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Delete the physical file
    const imagePath = path.join(process.cwd(), "public", image.imageUrl);

    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (err) {
      console.error("Error deleting image file:", err);
    }

    // Remove from script if needed
    const script = await Script.findById(image.scriptId);
    if (script && script.images) {
      script.images = script.images.filter((img) => !img._id.equals(id));
      await script.save();
    }

    // Delete the image document
    await Image.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete image",
    });
  }
};
