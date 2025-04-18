const {
  generateVoice,
  getAvailableVoices,
  customizeVoiceSettings,
} = require("../services/voiceService");
const { getImageScript } = require("../services/geminiService");
const ttsConfig = require("../config/ttsConfig");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { MongoClient, ObjectId } = require("mongodb");

// MongoDB connection details
const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

// Directory for storing generated audio files
const AUDIO_DIR = path.join(__dirname, "../../public/audio");

// Ensure the audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

exports.generateVoice = async (req, res) => {
  try {
    const {
      text,
      style = "formal",
      language = "vi",
      scriptId,
      voiceId,
      pitch = 0,
      speakingRate = 1.0,
      volumeGain = 0,
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Nội dung văn bản không được để trống",
      });
    }

    console.log(`Generating voice for text: "${text.substring(0, 50)}..."`, {
      style,
      language,
      scriptId: scriptId ? scriptId.substring(0, 10) + "..." : "none",
      voiceId,
      pitch,
      speakingRate,
      volumeGain,
    });

    // Get audio buffer from TTS service with all settings
    const audioBuffer = await generateVoice(text, style, language, voiceId, {
      pitch,
      speakingRate,
      volumeGain,
    });

    // Generate a unique filename
    const filename = `${uuidv4()}.mp3`;
    const filePath = path.join(AUDIO_DIR, filename);

    // Ensure directory exists
    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }

    // Save the audio file
    fs.writeFileSync(filePath, Buffer.from(audioBuffer, "base64"));

    console.log(
      `File saved to: ${filePath}, size: ${fs.statSync(filePath).size} bytes`
    );

    // Create public URL for the audio file
    const audioUrl = `/audio/${filename}`;

    // If scriptId is provided, store the association in database
    if (scriptId) {
      try {
        await client.connect();
        const db = client.db(dbName);
        await db.collection("topic_scripts").updateOne(
          { _id: new ObjectId(scriptId) },
          {
            $set: {
              audioUrl,
              lastGeneratedAt: new Date(),
            },
          }
        );
      } finally {
        await client.close();
      }
    }

    res.status(200).json({
      success: true,
      audioUrl,
      style,
      language,
    });
  } catch (error) {
    console.error("Error in generateVoice:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi tạo giọng nói",
    });
  }
};

exports.getVoiceSettings = async (req, res) => {
  try {
    // Get available voices from the service
    const voices = await getAvailableVoices();

    // Get supported styles and languages from config
    const styles = ttsConfig.styles;
    const languages = ttsConfig.supportedLanguages;

    res.status(200).json({
      success: true,
      voices,
      styles,
      languages,
      activeModel: ttsConfig.elevenlabs.activeModel,
      defaultVoices: ttsConfig.elevenlabs.defaultVoice,
    });
  } catch (error) {
    console.error("Error fetching voice settings:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi lấy cài đặt giọng nói",
    });
  }
};

/**
 * Customize voice settings for a specific script
 */
exports.customizeVoice = async (req, res) => {
  try {
    const { scriptId, style, language, voiceId, ...customSettings } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        success: false,
        message: "ID của kịch bản không được để trống",
      });
    }

    // Update voice settings in the database
    const result = await customizeVoiceSettings(scriptId, style, language, {
      voiceId,
      ...customSettings,
    });

    res.status(200).json({
      success: true,
      message: "Cài đặt giọng nói đã được cập nhật thành công",
      settings: result.voiceSettings,
    });
  } catch (error) {
    console.error("Error customizing voice settings:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi cập nhật cài đặt giọng nói",
    });
  }
};

/**
 * Generate voices for each image's dialogue in a script
 */
exports.generateVoiceSegments = async (req, res) => {
  try {
    const { scriptId } = req.body;

    let mongoClient = null;
    try {
      mongoClient = new MongoClient(uri);
      await mongoClient.connect();
      const db = mongoClient.db(dbName);
      const scriptsCollection = db.collection("topic_scripts");

      // Get the script with its images
      const script = await scriptsCollection.findOne({
        _id: new ObjectId(scriptId),
      });

      if (!script) {
        return res.status(404).json({
          success: false,
          message: "Script not found",
        });
      }

      if (!script.images || script.images.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No images found in this script",
        });
      }

      // Sort images by index
      const sortedImages = [...script.images].sort((a, b) => a.index - b.index);

      console.log(`Found ${sortedImages.length} images to process`);

      const results = [];

      // Extract voice settings from script
      const {
        style = "formal",
        language = "vi",
        voiceId,
        pitch = 0,
        speakingRate = 1.0,
        volumeGain = 0,
      } = script.voiceSettings || {};

      // Process each image and its dialogue
      for (let i = 0; i < sortedImages.length; i++) {
        const image = sortedImages[i];

        // Check if audio already exists
        if (image.audioUrl) {
          console.log(
            `Audio already exists for image ${i}: ${image.audioUrl}. Skipping...`
          );
          results.push({
            imageIndex: image.index || i,
            imageUrl: image.imageUrl || image.url,
            audioUrl: image.audioUrl,
            text: image.dialogue || "No dialogue",
          });
          continue;
        }

        // Skip if no dialogue
        if (!image.dialogue) {
          console.warn(
            `No dialogue found for image at index ${image.index || i}`
          );
          continue;
        }

        // Generate a unique filename for this audio segment
        const audioFileName = `${scriptId}_segment_${i}_${Date.now()}.mp3`;
        const audioFilePath = path.join(AUDIO_DIR, audioFileName);
        const audioUrl = `/audio/${audioFileName}`;

        // Generate audio for this dialogue
        console.log(
          `Generating audio for segment ${i + 1}: "${image.dialogue.substring(
            0,
            50
          )}..."`
        );

        const audioBuffer = await generateVoice(
          image.dialogue,
          style,
          language,
          voiceId,
          {
            pitch,
            speakingRate,
            volumeGain,
          }
        );

        // Save the audio file
        fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer, "base64"));

        // Update the image in the database with its audio URL
        const updateResult = await scriptsCollection.updateOne(
          {
            _id: new ObjectId(scriptId),
            "images._id": new ObjectId(image._id),
          },
          {
            $set: {
              "images.$.audioUrl": audioUrl,
            },
          }
        );

        results.push({
          imageIndex: image.index || i,
          imageUrl: image.imageUrl || image.url,
          audioUrl,
          text: image.dialogue,
        });

        console.log(`Generated audio for image index ${image.index || i}`);
      }

      // Update the script document with the generation timestamp
      await scriptsCollection.updateOne(
        { _id: new ObjectId(scriptId) },
        {
          $set: {
            voiceGeneratedAt: new Date(),
          },
        }
      );

      res.status(200).json({
        success: true,
        message: `Generated ${results.length} audio segments`,
        results,
      });
    } finally {
      if (mongoClient) {
        await mongoClient.close();
      }
    }
  } catch (error) {
    console.error("Error in generateVoiceSegments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating voice segments",
    });
  }
};
