import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

interface Voice {
  id: string;
  name: string;
  language: string;
  preview?: string;
}

interface VoiceSettingsProps {
  scriptId: string;
  scriptContent: string;
  onComplete: () => void;
  onBack: () => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  scriptId,
  scriptContent,
  onComplete,
  onBack,
}) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [language, setLanguage] = useState<string>("vi");
  const [voiceStyle, setVoiceStyle] = useState<string>("formal");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [previewAudio, setPreviewAudio] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [customSettings, setCustomSettings] = useState({
    pitch: 0,
    speakingRate: 1.0,
    volumeGain: 0,
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const [supportedLanguages, setSupportedLanguages] = useState<
    { code: string; name: string }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [voiceStyles, setVoiceStyles] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetchVoiceSettings();
  }, []);

  const fetchVoiceSettings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/voice/settings");
      if (response.data.success) {
        setVoices(response.data.voices || []);
        setVoiceStyles(response.data.styles || {});
        setSupportedLanguages(response.data.languages || []);

        // Set default voice based on current language
        if (
          response.data.defaultVoices &&
          response.data.defaultVoices[language]
        ) {
          setSelectedVoice(response.data.defaultVoices[language]);
        } else if (response.data.voices && response.data.voices.length > 0) {
          setSelectedVoice(response.data.voices[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching voice settings:", err);
      setError("Không thể tải cài đặt giọng nói");
    } finally {
      setIsLoading(false);
    }
  };

  // Update the generatePreview function

  const generatePreview = async () => {
    setIsGenerating(true);
    setError("");

    // Get a short sample from the script (first 100 characters)
    const previewText = scriptContent.slice(0, 200) + "...";

    try {
      const response = await axios.post("/api/voice/generate", {
        text: previewText,
        style: voiceStyle,
        language: language,
        scriptId: scriptId,
        voiceId: selectedVoice,
        // Include the custom settings
        pitch: customSettings.pitch,
        speakingRate: customSettings.speakingRate,
        volumeGain: customSettings.volumeGain,
      });

      if (response.data.success) {
        // Fix: Use the backend URL instead of frontend URL
        const audioPath = response.data.audioUrl;

        // For development: Use the backend server URL (adjust if needed)
        const backendBaseUrl = "http://localhost:3000"; // Backend server URL

        // If audioUrl starts with '/', it's a relative path from server root
        const fullAudioUrl = audioPath.startsWith("http")
          ? audioPath
          : `${backendBaseUrl}${audioPath}`;

        setPreviewAudio(fullAudioUrl);

        console.log("Audio URL received:", response.data.audioUrl);
        console.log("Full audio URL to play:", fullAudioUrl);

        // Play the audio automatically
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.warn("Auto-play failed:", err);
            });
          }
        }, 500);
      } else {
        setError("Không thể tạo bản xem trước giọng nói");
      }
    } catch (err) {
      console.error("Error generating voice preview:", err);
      setError("Đã xảy ra lỗi khi tạo bản xem trước");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveVoiceSettings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post("/api/voice/customize", {
        scriptId,
        style: voiceStyle,
        language,
        voiceId: selectedVoice,
        ...customSettings,
      });

      if (response.data.success) {
        onComplete();
      } else {
        setError("Không thể lưu cài đặt giọng nói");
      }
    } catch (err) {
      console.error("Error saving voice settings:", err);
      setError("Đã xảy ra lỗi khi lưu cài đặt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setting: string
  ) => {
    const value = parseFloat(event.target.value);
    setCustomSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4">Cài đặt giọng nói</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block font-medium mb-2">Ngôn ngữ:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isLoading}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-2">Giọng nói:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={isLoading}
          >
            {voices
              .filter(
                (voice) =>
                  voice.language === language || voice.language === "multi"
              )
              .map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Phong cách:</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.keys(voiceStyles).map((style) => (
            <div
              key={style}
              className={`border-2 p-3 rounded-lg cursor-pointer ${
                voiceStyle === style
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              onClick={() => setVoiceStyle(style)}
            >
              <div className="font-medium capitalize">{style}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">Tùy chỉnh nâng cao:</h3>

        <div className="space-y-4">
          <div>
            <label className="flex justify-between">
              <span>Tốc độ đọc: {customSettings.speakingRate.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={customSettings.speakingRate}
              onChange={(e) => handleSliderChange(e, "speakingRate")}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Chậm</span>
              <span>Nhanh</span>
            </div>
          </div>

          <div>
            <label className="flex justify-between">
              <span>
                Âm điệu: {customSettings.pitch > 0 ? "+" : ""}
                {customSettings.pitch}
              </span>
            </label>
            <input
              type="range"
              min="-10"
              max="10"
              step="1"
              value={customSettings.pitch}
              onChange={(e) => handleSliderChange(e, "pitch")}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Thấp</span>
              <span>Cao</span>
            </div>
          </div>

          <div>
            <label className="flex justify-between">
              <span>
                Âm lượng: {customSettings.volumeGain > 0 ? "+" : ""}
                {customSettings.volumeGain}
              </span>
            </label>
            <input
              type="range"
              min="-6"
              max="6"
              step="1"
              value={customSettings.volumeGain}
              onChange={(e) => handleSliderChange(e, "volumeGain")}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Nhỏ</span>
              <span>Lớn</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">Xem trước:</h3>
        <div className="flex space-x-3">
          <button
            onClick={generatePreview}
            disabled={isGenerating || !selectedVoice}
            className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded font-medium"
          >
            {isGenerating ? "Đang tạo..." : "Nghe thử giọng đọc"}
          </button>

          {previewAudio && (
            <div className="flex flex-col items-start">
              <audio
                ref={audioRef}
                src={previewAudio}
                controls
                className="h-10 mb-1"
              />
              <a
                href={previewAudio}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 text-xs hover:underline"
              >
                Mở trong tab mới nếu gặp lỗi phát
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium"
        >
          Quay lại
        </button>

        <button
          onClick={saveVoiceSettings}
          disabled={isLoading || !selectedVoice}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium"
        >
          {isLoading ? "Đang lưu..." : "Lưu cài đặt và tiếp tục"}
        </button>
      </div>
    </div>
  );
};

export default VoiceSettings;
