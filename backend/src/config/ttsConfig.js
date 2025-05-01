/**
 * Cấu hình cho dịch vụ Text-to-Speech
 * Sử dụng ElevenLabs với model Eleven Flash V2.5 để hỗ trợ tiếng Việt
 */
module.exports = {
  // Dịch vụ TTS đang hoạt động
  service: "elevenlabs",

  // Cấu hình ElevenLabs
  elevenlabs: {
    endpoint: "https://api.elevenlabs.io/v1/text-to-speech",
    // apiKey: "sk_34c05075798f0d2cc85faab0d78f2067afe556e5f9a02701", // Khóa miễn phí
    apiKey : "sk_0a60cfbd5d4138057b2b96d1a8dc4614eac614fb5a0a7287",
    voicesUrl: "https://api.elevenlabs.io/v1/voices",
    defaultVoice: {
      en: "21m00Tcm4TlvDq8ikWAM", // Giọng Rachel cho tiếng Anh
      vi: "21m00Tcm4TlvDq8ikWAM", // Giọng Rachel cho tiếng Việt (khuyến nghị dùng giọng tiếng Việt)
    },
    // Cấu hình model
    models: {
      multilingual: "eleven_multilingual_v2", // Nhiều ngôn ngữ, nhưng không hỗ trợ tiếng Việt theo bạn
      turbo: "eleven_turbo_v2", // Chỉ tiếng Anh, độ trễ thấp
      flash: "eleven_flash_v2_5", // Flash V2.5, hỗ trợ 32 ngôn ngữ bao gồm tiếng Việt
    },
    // Model đang hoạt động
    activeModel: "eleven_flash_v2_5", // Sử dụng Flash V2.5 để hỗ trợ tiếng Việt
    // Các cài đặt khác
    stability: 0.5,
    similarity_boost: 0.5,
  },

  // Các kiểu giọng nói
  styles: {
    formal: {
      pitch: 0.0,
      speakingRate: 0.9,
      volumeGainDb: 0,
    },
    dramatic: {
      pitch: -2.0,
      speakingRate: 0.85,
      volumeGainDb: 3,
    },
    humorous: {
      pitch: 2.0,
      speakingRate: 1.1,
      volumeGainDb: 2,
    },
  },

  // Ngôn ngữ hỗ trợ
  supportedLanguages: [
    { code: "vi", name: "Tiếng Việt" },
    { code: "en", name: "English" },
  ],
};
