const {
  generateVoice,
  getAvailableVoices,
  customizeVoiceSettings,
} = require("../services/voiceService");
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
