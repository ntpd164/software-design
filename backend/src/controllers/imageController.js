const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const {
  generateImage,
  deleteImage,
  parseImageDescriptions,
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

    // Check if we have valid paths
    if (!originalImage.imageUrl) {
      return res.status(500).json({
        success: false,
        message: "Original image URL is undefined",
      });
    }

    if (!result.relativeImagePath) {
      return res.status(500).json({
        success: false,
        message: "New image path is undefined",
      });
    }

    // Get the file paths - Fix the property name: relativeImagePath vs imageUrl
    const originalPath = path.join(
      process.cwd(),
      "public",
      originalImage.imageUrl
    );
    const newPath = path.join(
      process.cwd(),
      "public",
      result.relativeImagePath
    );

    console.log(`Original path: ${originalPath}`);
    console.log(`New path: ${newPath}`);

    try {
      // Make sure directory exists
      fs.mkdirSync(path.dirname(originalPath), { recursive: true });

      // Copy new image to old path
      fs.copyFileSync(newPath, originalPath);

      // Delete new image file
      fs.unlinkSync(newPath);

      console.log("File replaced successfully");

      // Update timestamp but keep same path
      const updatedImage = await Image.findByIdAndUpdate(
        imageId,
        { updatedAt: new Date() },
        { new: true }
      );

      // Update MongoDB document in topic_scripts collection
      await client.connect();
      const database = client.db(dbName);
      await database.collection("topic_scripts").updateOne(
        {
          _id: new ObjectId(scriptId),
          "images._id": new ObjectId(imageId),
        },
        {
          $set: {
            "images.$.updatedAt": new Date(),
          },
        }
      );

      res.status(200).json({
        success: true,
        message: "Image regenerated successfully",
        data: updatedImage,
      });
    } catch (fsError) {
      console.error("File operation error:", fsError);

      // If file operations fail, just update the path
      const updatedImage = await Image.findByIdAndUpdate(
        imageId,
        {
          imageUrl: result.relativeImagePath,
          updatedAt: new Date(),
        },
        { new: true }
      );

      // Update MongoDB document in topic_scripts collection
      await client.connect();
      const database = client.db(dbName);
      await database.collection("topic_scripts").updateOne(
        {
          _id: new ObjectId(scriptId),
          "images._id": new ObjectId(imageId),
        },
        {
          $set: {
            "images.$.imageUrl": result.relativeImagePath,
            "images.$.updatedAt": new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Image regenerated with new path",
        data: updatedImage,
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
