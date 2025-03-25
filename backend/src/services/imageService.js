const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const translate = require("google-translate-api");

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
 * @returns {Promise<Object>} Object containing the image path
 */
async function generateImage(prompt, scriptId, num_inference_steps = 20) {
  if (!prompt) {
    throw new Error("Prompt is required for image generation");
  }

  try {
    // Step 1: Translate prompt to English if not already in English
    const translatedPrompt = await translateToEnglish(prompt);
    console.log(`Original prompt: "${prompt}"`);

    if (translatedPrompt !== prompt) {
      console.log(`Translated prompt: "${translatedPrompt}"`);
    }

    // Step 2: Enhance the translated prompt
    const enhancedPrompt = enhancePrompt(translatedPrompt);
    console.log(`Enhanced prompt: "${enhancedPrompt}"`);

    // Step 3: Call Cloudflare API with the enhanced translated prompt
    const response = await axios({
      method: "post",
      url: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`,
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
    const filename = `${uuidv4()}.jpeg`;
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
 * Enhance a prompt to get better image generation results
 * @param {string} originalPrompt - The user's original prompt
 * @returns {string} - Enhanced prompt
 */
function enhancePrompt(originalPrompt) {
  // Don't enhance already detailed prompts (over 100 chars)
  if (originalPrompt.length > 100) return originalPrompt;

  // Add quality boosters and style guidance
  const qualityBoosters = [
    "detailed",
    "high quality",
    "masterpiece",
    "professional",
    "sharp focus",
    "highly detailed",
    "intricate details",
  ];

  // Select 2-3 random boosters to avoid repetition
  const selectedBoosters = [];
  for (let i = 0; i < 3; i++) {
    const booster =
      qualityBoosters[Math.floor(Math.random() * qualityBoosters.length)];
    if (!selectedBoosters.includes(booster)) {
      selectedBoosters.push(booster);
    }
  }

  return `${originalPrompt}, ${selectedBoosters.join(", ")}`;
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
};
