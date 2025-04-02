const axios = require("axios");
const ttsConfig = require("../config/ttsConfig");
const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");

const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

const TTS_SERVICES = {
  amazon: "amazon",
  google: "google",
  elevenlabs: "elevenlabs",
};

/**
 * Generates voice audio from text using the configured TTS service
 * @param {string} text - The text to convert to speech
 * @param {string} style - The voice style (formal, dramatic, humorous)
 * @param {string} language - The language code (e.g., 'vi', 'en')
 * @param {string} voiceId - The ID of the voice to use
 * @param {object} additionalSettings - Additional voice settings (pitch, speakingRate, volumeGain)
 * @returns {Promise<Buffer>} - Audio data as a buffer
 */
const generateVoice = async (
  text,
  style = "formal",
  language = "vi",
  voiceId = null,
  additionalSettings = {}
) => {
  let audioData;

  switch (ttsConfig.service) {
    case TTS_SERVICES.elevenlabs:
      audioData = await generateElevenLabsVoice(
        text,
        style,
        language,
        voiceId,
        additionalSettings
      );
      break;
    default:
      throw new Error("Unsupported TTS service");
  }

  return audioData;
};

// Update the ElevenLabs voice generation function
const generateElevenLabsVoice = async (
  text,
  style,
  language,
  customVoiceId = null,
  additionalSettings = {}
) => {
  try {
    console.log(`Generating ElevenLabs voice with settings:`, {
      textLength: text.length,
      style,
      language,
      customVoiceId,
      additionalSettings,
    });

    // Get voice ID based on language or use custom voice if provided
    const voiceId =
      customVoiceId ||
      ttsConfig.elevenlabs.defaultVoice[language] ||
      ttsConfig.elevenlabs.defaultVoice.en;

    // Set voice parameters based on style
    let stability = ttsConfig.elevenlabs.stability;
    let similarity_boost = ttsConfig.elevenlabs.similarity_boost;

    // Apply style adjustments
    if (style === "dramatic") {
      stability = 0.3;
      similarity_boost = 0.7;
    } else if (style === "humorous") {
      stability = 0.7;
      similarity_boost = 0.3;
    }

    // Wrap text in SSML tags to control rate and pitch if specified
    let processedText = text;
    if (
      additionalSettings.speakingRate !== 1.0 ||
      additionalSettings.pitch !== 0
    ) {
      // Calculate relative values for SSML
      // For rate: 0.5 = half speed, 2.0 = double speed
      const rateValue = additionalSettings.speakingRate || 1.0;

      // For pitch: -10 to 10 range needs to be mapped to something like -50% to +50%
      const pitchValue = additionalSettings.pitch
        ? `${additionalSettings.pitch * 5}%`
        : "0%";

      // Apply SSML tags
      processedText = `<speak><prosody rate="${rateValue}" pitch="${pitchValue}">${text}</prosody></speak>`;
      console.log(
        "Applied SSML to text:",
        processedText.substring(0, 100) + "..."
      );
    }

    // Get the active model from config
    const modelId =
      ttsConfig.elevenlabs.activeModel ||
      ttsConfig.elevenlabs.models.multilingual;

    // Prepare the request to ElevenLabs API
    const endpoint = `${ttsConfig.elevenlabs.endpoint}/${voiceId}`;

    const response = await axios({
      method: "POST",
      url: endpoint,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ttsConfig.elevenlabs.apiKey,
      },
      data: {
        text: processedText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost,
        },
      },
      responseType: "arraybuffer",
    });

    // Convert the audio buffer to base64
    return Buffer.from(response.data).toString("base64");
  } catch (error) {
    console.error("Error generating ElevenLabs voice:", error);

    // Log more details about the error
    if (error.response) {
      console.error("ElevenLabs API error:", {
        status: error.response.status,
        data: error.response.data ? error.response.data.toString() : "No data",
        headers: error.response.headers,
      });
    }

    throw new Error(
      "Không thể tạo giọng nói với ElevenLabs: " +
        (error.message || "Unknown error")
    );
  }
};

// Function to get available voices
const getAvailableVoices = async () => {
  try {
    return await getElevenLabsVoices();
  } catch (error) {
    console.error("Error getting voices:", error);
    return [];
  }
};

// Get ElevenLabs voices
const getElevenLabsVoices = async () => {
  try {
    const response = await axios.get(ttsConfig.elevenlabs.voicesUrl, {
      headers: {
        "xi-api-key": ttsConfig.elevenlabs.apiKey,
      },
    });

    // Format the voices to match our internal structure
    return response.data.voices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      language: voice.labels?.language || "en", // Default to English if no language specified
      preview: voice.preview_url,
    }));
  } catch (error) {
    console.error("Error fetching ElevenLabs voices:", error);

    // Return some default voices if API call fails
    return [
      {
        id: "21m00Tcm4TlvDq8ikWAM",
        name: "Rachel",
        language: "en",
        preview: null,
      },
      {
        id: "AZnzlk1XvdvUeBnXmlld",
        name: "Domi",
        language: "en",
        preview: null,
      },
      {
        id: "EXAVITQu4vr4xnSDxMaL",
        name: "Bella",
        language: "en",
        preview: null,
      },
      {
        id: "ErXwobaYiN019PkySvjV",
        name: "Antoni",
        language: "en",
        preview: null,
      },
    ];
  }
};

/**
 * Customizes voice settings for a specific script
 */
const customizeVoiceSettings = async (
  scriptId,
  style,
  language,
  customSettings = {}
) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    // Get the script
    const script = await scriptsCollection.findOne({
      _id: new ObjectId(scriptId),
    });

    if (!script) {
      throw new Error("Script not found");
    }

    // Update the script with voice settings
    const voiceSettings = {
      style: style || "formal",
      language: language || "vi",
      ...customSettings,
    };

    await scriptsCollection.updateOne(
      { _id: new ObjectId(scriptId) },
      {
        $set: {
          voiceSettings,
          updatedAt: new Date(),
        },
      }
    );

    return {
      scriptId,
      voiceSettings,
      updated: true,
    };
  } catch (error) {
    console.error("Error customizing voice settings:", error);
    throw error;
  } finally {
    await client.close();
  }
};

module.exports = {
  generateVoice,
  getAvailableVoices,
  customizeVoiceSettings,
};
