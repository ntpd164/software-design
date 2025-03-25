const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const { generateImage, deleteImage } = require("../services/imageService");
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

        console.log(
          `Added image to script ${scriptId}: ${result.relativeImagePath}`
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
        model: "@cf/bytedance/stable-diffusion-xl-lightning",
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
