const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const translate = require("google-translate-api-x");
const { ObjectId } = require("mongodb");

// Cloudflare API configuration
const CF_API_TOKEN = "WYrUKlkpHzAQQl7HO_ix5wEJSHCppgYtBDrdrVS-";
const CF_ACCOUNT_ID = "93d0abeddf7ffb4e73ed25ae641b8bea";

// Directory for storing generated images
const IMAGE_DIR = path.join(__dirname, "../../public/images");

// Ensure the image directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * Generate an image using Cloudflare's model with language translation
 * @param {string} prompt - The text prompt in any language
 * @param {string} scriptId - Script ID for reference (not used in the API call)
 * @param {number} num_inference_steps - Number of inference steps (higher = better quality)
 * @param {string} style - Optional style modifier (e.g., "oil painting", "anime style")
 * @returns {Promise<Object>} Object containing the image path
 */
async function generateImage(
  prompt,
  scriptId,
  style = null,
  num_inference_steps = 20
) {
  if (!prompt) {
    throw new Error("Prompt is required for image generation");
  }

  try {
    // Step 1: Translate prompt to English if not already in English
    const translatedPrompt = await translateToEnglish(prompt);

    // Step 2: Enhance the translated prompt with optional style
    const enhancedPrompt = style
      ? enhancePromptWithStyle(translatedPrompt, style)
      : enhancePrompt(translatedPrompt);

    // Step 3: Call Cloudflare API with the enhanced translated prompt
    const response = await axios({
      method: "post",
      url: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: {
        prompt: enhancedPrompt,
        num_inference_steps,
        guidance_scale: 8.5, // Higher value = stick closer to prompt
        negative_prompt:
          "blurry, bad quality, distorted, deformed, disfigured, poor anatomy, bad proportions, text, watermark, signature, cropped image",
        seed: Math.floor(Math.random() * 2147483647), // Reproducible results if needed
        width: 1024,
        height: 1024,
      },
      responseType: "arraybuffer",
    });

    // Create a unique filename
    const filename = `${uuidv4()}.png`;
    const imagePath = path.join(IMAGE_DIR, filename);

    // Save the image to disk (binary data)
    fs.writeFileSync(imagePath, response.data);

    console.log(`Image saved to: ${imagePath}`);

    // Return the path information with translation metadata
    return {
      success: true,
      imagePath,
      relativeImagePath: `/images/${filename}`,
      originalPrompt: prompt,
      translatedPrompt: translatedPrompt !== prompt ? translatedPrompt : null,
      enhancedPrompt,
      style: style || null,
    };
  } catch (error) {
    console.error("Error generating image:", error);

    if (error.response) {
      console.error("API status:", error.response.status);
      console.error("API headers:", error.response.headers);
    }

    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

/**
 * Enhance prompt with specific style preferences
 * @param {string} originalPrompt - The user's original prompt
 * @param {string} style - Style modifier (e.g., "oil painting", "anime style")
 * @returns {string} - Enhanced prompt optimized for image generation with style
 */
function enhancePromptWithStyle(originalPrompt, style) {
  // Skip enhancement for already detailed prompts
  if (originalPrompt.length > 100 && style.length > 20) {
    // If both prompt and style are detailed, just combine them
    return `${originalPrompt}, ${style}`;
  }

  // Detect prompt type to apply appropriate enhancements
  const promptType = detectPromptType(originalPrompt.toLowerCase());

  // Quality boosters (general improvements)
  const qualityBoosters = [
    "detailed",
    "high quality",
    "masterpiece",
    "professional",
    "sharp focus",
    "highly detailed",
  ];

  // Select 1-2 random quality boosters (fewer than before to emphasize style more)
  const selectedBoosters = [];
  for (let i = 0; i < 2; i++) {
    const booster =
      qualityBoosters[Math.floor(Math.random() * qualityBoosters.length)];
    if (!selectedBoosters.includes(booster)) {
      selectedBoosters.push(booster);
    }
  }

  // Join all enhancements with original prompt, prioritizing style
  return `${originalPrompt}, ${style}, ${selectedBoosters.join(", ")}`;
}

/**
 * Detect the type of image requested in the prompt
 * @param {string} prompt - Lowercase prompt text
 * @returns {string} - Detected prompt type
 */
function detectPromptType(prompt) {
  if (/(person|portrait|face|man|woman|girl|boy|human)/i.test(prompt)) {
    return "portrait";
  } else if (
    /(landscape|scenery|mountain|forest|beach|nature|sunset|vista)/i.test(
      prompt
    )
  ) {
    return "landscape";
  } else if (/(cat|dog|bird|animal|pet|wildlife|creature)/i.test(prompt)) {
    return "animal";
  } else if (
    /(fantasy|magic|wizard|dragon|mythical|myth|elf|dwarf|fairy)/i.test(prompt)
  ) {
    return "fantasy";
  } else if (
    /(future|spacecraft|space|sci-fi|science fiction|planet)/i.test(prompt)
  ) {
    return "sci_fi";
  } else if (/(cyberpunk|neon|dystopian|cyber|techno|hacker)/i.test(prompt)) {
    return "cyberpunk";
  } else if (/(anime|manga|cartoon|stylized|illustration)/i.test(prompt)) {
    return "anime";
  }

  return "general"; // Default type
}

/**
 * Translate text to English using LibreTranslate
 * @param {string} text - Text in any language
 * @returns {Promise<string>} - Translated text in English
 */
async function translateToEnglish(text) {
  try {
      const result = await translate(text, { to: "en" });
      return result.text;
  } catch (error) {
    console.error("Translation error:", error.message);
    return text;
  }
}

/**
 * Parse image descriptions from the formatted prompt output
 * @param {string} promptOutput - Formatted text from Gemini prompt response
 * @returns {Array<string>} - Array of individual image descriptions
 */
function parseImageDescriptions(promptOutput) {
  if (!promptOutput) return [];
  
  console.log("Parsing prompt output for image descriptions...");
  
  // Check if we have the expected format (list of bullet points)
  if (promptOutput.includes("Dưới đây là danh sách các mô tả hình ảnh") || 
      promptOutput.includes("- ")) {
    
    // Split by newlines and filter lines that start with dash (-)
    const lines = promptOutput.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim()) // Remove dash prefix and trim
      .filter(line => line.length > 0); // Remove empty lines
    
    console.log(`Found ${lines.length} image descriptions`);
    return lines;
  } 
  
  // Fallback: try to extract anything that looks like an image description
  // This is in case the format changes slightly
  const possibleDescriptions = promptOutput.split('\n')
    .filter(line => line.trim().length > 0)
    .filter(line => !line.includes("Dưới đây là danh sách") && 
                    !line.includes("mô tả hình ảnh") &&
                    !line.startsWith('#'))
    .map(line => line.replace(/^-\s*/, '').trim());

  return possibleDescriptions;
}

/**
 * Replace an existing image with a new one
 * @param {Object} originalImage - The original image document from MongoDB
 * @param {string} newImagePath - Path to the new image file
 * @param {string} scriptId - ID of the script the image belongs to
 * @param {MongoDB.Client} dbClient - MongoDB client instance
 * @returns {Promise<Object>} Updated image document and status information
 */
async function replaceImage(originalImage, newImagePath, scriptId, dbClient) {
  if (!originalImage || !originalImage.imageUrl) {
    throw new Error("Original image is invalid or missing URL");
  }

  if (!newImagePath) {
    throw new Error("New image path is required");
  }
  
  // Get the file paths
  const originalPath = path.join(
    process.cwd(),
    "public",
    originalImage.imageUrl
  );
  
  const newPath = path.join(
    process.cwd(),
    "public",
    newImagePath
  );

  console.log(`Original path: ${originalPath}`);
  console.log(`New path: ${newPath}`);
  
  let updatedImage;
  let result = {
    method: "replace", // Will be either "replace" (copied file) or "path_update" (changed path in DB)
    originalPath,
    newPath
  };

  try {
    // Make sure directory exists
    fs.mkdirSync(path.dirname(originalPath), { recursive: true });

    // Copy new image to old path
    fs.copyFileSync(newPath, originalPath);

    // Delete new image file
    fs.unlinkSync(newPath);

    console.log("File replaced successfully");
    
    // Update timestamp but keep same path
    updatedImage = await originalImage.constructor.findByIdAndUpdate(
      originalImage._id,
      { updatedAt: new Date() },
      { new: true }
    );

    // Update MongoDB document in topic_scripts collection
    const database = dbClient.db("literature_db");
    await database.collection("topic_scripts").updateOne(
      { 
        _id: new ObjectId(scriptId),
        "images._id": new ObjectId(originalImage._id)
      },
      {
        $set: {
          "images.$.updatedAt": new Date()
        }
      }
    );
  } catch (fsError) {
    console.error("File operation error:", fsError);
    
    // If file operations fail, just update the path
    updatedImage = await originalImage.constructor.findByIdAndUpdate(
      originalImage._id,
      {
        imageUrl: newImagePath,
        updatedAt: new Date()
      },
      { new: true }
    );

    // Update MongoDB document in topic_scripts collection
    const database = dbClient.db("literature_db");
    await database.collection("topic_scripts").updateOne(
      { 
        _id: new ObjectId(scriptId),
        "images._id": new ObjectId(originalImage._id)
      },
      {
        $set: {
          "images.$.imageUrl": newImagePath,
          "images.$.updatedAt": new Date()
        }
      }
    );
    
    result.method = "path_update";
  }
  
  return {
    success: true,
    updatedImage,
    result
  };
}

/**
 * Delete an image file from the filesystem
 * @param {string} imagePath - Full path to the image file
 * @returns {Promise<boolean>} Whether the deletion was successful
 */
async function deleteImage(imagePath) {
  try {
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

module.exports = {
  generateImage,
  deleteImage,
  parseImageDescriptions,
  replaceImage
};

// async function generateImage(prompt, num_steps = 8) {
//   if (!prompt) {
//     throw new Error("Prompt is required for image generation");
//   }

//   console.log(
//     `Generating image with prompt: "${prompt}" using ${num_steps} steps`
//   );

//   try {
//     // Call Cloudflare API
//     const response = await axios({
//       method: "post",
//       url: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
//       headers: {
//         Authorization: `Bearer ${CF_API_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       data: {
//         prompt,
//         num_steps, // Using 8 steps for best quality as requested
//       },
//     });

//     // Check if the API call was successful
//     if (!response.data.success) {
//       console.error("Cloudflare API error:", response.data.errors);
//       throw new Error(
//         `Cloudflare API error: ${JSON.stringify(response.data.errors)}`
//       );
//     }

//     // Extract base64 image data
//     const base64Data = response.data.result.image;

//     // Convert base64 to buffer
//     const buffer = Buffer.from(base64Data, "base64");

//     // Create a unique filename
//     const filename = `image-${uuidv4()}.jpeg`;
//     const imagePath = path.join(IMAGE_DIR, filename);

//     // Save the image to disk
//     fs.writeFileSync(imagePath, buffer);

//     console.log(`Image saved to: ${imagePath}`);

//     // Return the relative path and base64 data
//     return {
//       success: true,
//       imagePath,
//       relativeImagePath: `/images/${filename}`,
//       base64Data,
//     };
//   } catch (error) {
//     console.error("Error generating image:", error);

//     if (error.response) {
//       console.error("API response:", error.response.data);
//     }

//     throw new Error(`Failed to generate image: ${error.message}`);
//   }
// }
