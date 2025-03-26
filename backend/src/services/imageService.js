const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const translate = require("google-translate-api-x");

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
 * Enhanced prompt engineering for better image generation results
 * @param {string} originalPrompt - The user's original prompt
 * @returns {string} - Enhanced prompt optimized for image generation
 */
function enhancePrompt(originalPrompt) {
  // Skip enhancement for already detailed prompts
  if (originalPrompt.length > 100) return originalPrompt;
  
  // Detect prompt type to apply appropriate enhancements
  const promptType = detectPromptType(originalPrompt.toLowerCase());
  
  // Quality boosters (general improvements)
  const qualityBoosters = [
    "detailed", "high quality", "masterpiece", "professional", 
    "sharp focus", "highly detailed", "intricate details", "4k", "8k"
  ];
  
  // Style boosters (depend on prompt type)
  const styleModifiers = {
    portrait: ["professional portrait", "studio lighting", "dramatic lighting", "perfect composition"],
    landscape: ["scenic view", "golden hour", "beautiful sky", "atmospheric", "panoramic view"],
    animal: ["wildlife photography", "natural habitat", "perfect focus", "detailed fur/feathers"],
    fantasy: ["fantasy art", "epic scene", "magical atmosphere", "digital painting"],
    sci_fi: ["futuristic", "sci-fi aesthetic", "cinematic", "concept art", "matte painting"],
    cyberpunk: ["neon lighting", "futuristic city", "high contrast", "digital art", "cinematic"],
    anime: ["anime style", "cel shaded", "vibrant colors", "illustrated"]
  };
  
  // Select 2-3 random quality boosters
  const selectedBoosters = [];
  for (let i = 0; i < 3; i++) {
    const booster = qualityBoosters[Math.floor(Math.random() * qualityBoosters.length)];
    if (!selectedBoosters.includes(booster)) {
      selectedBoosters.push(booster);
    }
  }
  
  // Add 1-2 style-specific modifiers if applicable
  if (styleModifiers[promptType]) {
    const styleOptions = styleModifiers[promptType];
    for (let i = 0; i < 2; i++) {
      if (styleOptions.length > 0) {
        const styleIndex = Math.floor(Math.random() * styleOptions.length);
        const style = styleOptions[styleIndex];
        selectedBoosters.push(style);
        // Remove to avoid duplication
        styleOptions.splice(styleIndex, 1);
      }
    }
  }
  
  // Join all enhancements with original prompt
  return `${originalPrompt}, ${selectedBoosters.join(", ")}`;
}

/**
 * Detect the type of image requested in the prompt
 * @param {string} prompt - Lowercase prompt text
 * @returns {string} - Detected prompt type
 */
function detectPromptType(prompt) {
  if (/(person|portrait|face|man|woman|girl|boy|human)/i.test(prompt)) {
    return "portrait";
  } else if (/(landscape|scenery|mountain|forest|beach|nature|sunset|vista)/i.test(prompt)) {
    return "landscape";
  } else if (/(cat|dog|bird|animal|pet|wildlife|creature)/i.test(prompt)) {
    return "animal";
  } else if (/(fantasy|magic|wizard|dragon|mythical|myth|elf|dwarf|fairy)/i.test(prompt)) {
    return "fantasy";
  } else if (/(future|spacecraft|space|sci-fi|science fiction|planet)/i.test(prompt)) {
    return "sci_fi";
  } else if (/(cyberpunk|neon|dystopian|cyber|techno|hacker)/i.test(prompt)) {
    return "cyberpunk";
  } else if (/(anime|manga|cartoon|stylized|illustration)/i.test(prompt)) {
    return "anime";
  }
  
  return "general"; // Default type
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