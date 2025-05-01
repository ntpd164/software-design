import React, { useState, useEffect, useRef } from "react";
import YouTubeShare from "./YoutubeShare";
import api from "../services/api";
import { useRef } from "react";

interface VideoCreationProps {
  scriptId: string;
  onBack: () => void;
  onComplete: () => void;
}

const VideoCreation: React.FC<VideoCreationProps> = ({
  scriptId,
  onBack,
  onComplete,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "generating" | "completed" | "failed"
  >("idle");
  const [voiceProgress, setVoiceProgress] = useState(0);
  const generateVoicesCalled = useRef(false);
  const [videoId, setVideoId] = useState<string>("");
  console.log("🚀 ~ videoId:", videoId);
  const [videoTitle, setVideoTitle] = useState<string>("");
  console.log("🚀 ~ videoTitle:", videoTitle);
  const [showYoutubeShare, setShowYoutubeShare] = useState(false);
  console.log("🚀 ~ showYoutubeShare:", showYoutubeShare);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  console.log("🚀 ~ youtubeUrl:", youtubeUrl);

  const getVideoUrl = (relativePath: string) => {
    if (
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://")
    ) {
      return relativePath;
    }
    return `http://localhost:3000${relativePath}`;
  };

  // Step 1: Generate voice for all dialog segments
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generateVoicesForDialogs = async () => {
    try {
      setVoiceStatus("generating");
      setVoiceProgress(10);
      setError("");

      // Get voice settings from script
      const settingsResponse = await api.get(`/api/topics/scripts/${scriptId}`);
      if (!settingsResponse.data.success) {
        throw new Error("Failed to get script data");
      }

      // Store video title from script
      setVideoTitle(settingsResponse.data.script.title || "AI Generated Video");

      const voiceSettings = settingsResponse.data.script.voiceSettings || {
        style: "formal",
        language: "vi",
        pitch: 0,
        speakingRate: 1.0,
        volumeGain: 0,
        voiceId: null,
      };

      // Call the API to generate voice segments
      const response = await api.post("/api/voice/generate-segments", {
        scriptId,
        style: voiceSettings.style,
        language: voiceSettings.language,
        voiceId: voiceSettings.voiceId,
        pitch: voiceSettings.pitch,
        speakingRate: voiceSettings.speakingRate,
        volumeGain: voiceSettings.volumeGain,
      });

      if (!response.data.success) {
        throw new Error("Failed to generate voice segments");
      }

      setVoiceStatus("completed");
      setVoiceProgress(100);

      // Proceed to create the video
      await createVideoWithAudio();
    } catch (err) {
      console.error("Error generating voice segments:", err);
      setError("Đã xảy ra lỗi khi tạo giọng nói cho các đoạn hội thoại");
      setVoiceStatus("failed");
    }
  };

  // Step 2: Create video with the generated audio
  const createVideoWithAudio = async () => {
    try {
      setIsCreating(true);
      setProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      const response = await api.post("/api/video/create-video", {
        scriptId,
        withAudio: true,
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Add this debugging line to see the actual response
      console.log("Video creation response:", response.data);

      // Update the video ID extraction logic in createVideoWithAudio function

      if (response.data.success) {
        setVideoUrl(getVideoUrl(response.data.video.url));

        // Update this section to extract ID from URL if not provided directly
        if (response.data.video._id) {
          console.log("Setting video ID from _id:", response.data.video._id);
          setVideoId(response.data.video._id);
        } else if (response.data.video.id) {
          console.log("Setting video ID from id:", response.data.video.id);
          setVideoId(response.data.video.id);
        } else {
          // Extract ID from the filename if possible
          const urlParts = response.data.video.url.split("/");
          const filename = urlParts[urlParts.length - 1];
          const filenameParts = filename.split("-");

          if (filenameParts.length > 1) {
            // Extract the ID part (before .mp4)
            const idWithExtension = filenameParts[filenameParts.length - 1];
            const id = idWithExtension.replace(".mp4", "");
            console.log("Extracted video ID from filename:", id);
            setVideoId(id);
          } else {
            // If we can't extract from filename, create a temporary ID
            const tempId = "temp-" + Date.now();
            console.log("Creating temporary video ID:", tempId);
            setVideoId(tempId);
          }
        }

        // For video loading
        setIsVideoLoading(false);
      } else {
        setError("Không thể tạo video. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error creating video:", err);
      setError("Đã xảy ra lỗi khi tạo video");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle YouTube share button click
  const handleShareToYoutube = () => {
    setShowYoutubeShare(true);
  };

  // Handle YouTube share completion
  const handleYoutubeShareComplete = (url: string) => {
    setYoutubeUrl(url);
    setShowYoutubeShare(false);
  };

  // Handle YouTube share cancellation
  const handleYoutubeShareCancel = () => {
    setShowYoutubeShare(false);
  };

  // Start the process automatically when component mounts
  useEffect(() => {
    // Check if generateVoicesForDialogs has already been called
    if (!generateVoicesCalled.current) {
      generateVoicesCalled.current = true;
      generateVoicesForDialogs();
    }

    return () => {
      // Cleanup function
    };
  }, [generateVoicesForDialogs, scriptId, voiceStatus]);

  useEffect(() => {
    if (videoUrl) {
      // Log the video URL for debugging
      console.log("Loading video from URL:", videoUrl);

      // Check if the video URL is accessible
      fetch(videoUrl, { method: "HEAD" })
        .then((response) => {
          if (response.ok) {
            console.log("Video URL is accessible:", response.status);
            console.log("Content-Type:", response.headers.get("content-type"));
            console.log(
              "Content-Length:",
              response.headers.get("content-length")
            );
          } else {
            console.error("Video URL is not accessible:", response.status);
          }
        })
        .catch((err) => {
          console.error("Error checking video URL:", err);
        });
    }
  }, [videoUrl]);

  console.log("🚀 ~ showYoutubeShare:", showYoutubeShare);
  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4">Tạo video</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Hệ thống sẽ tạo giọng nói cho từng đoạn hội thoại và ghép với hình ảnh
          tương ứng, sau đó kết hợp thành một video hoàn chỉnh.
        </p>
      </div>
      {/* Voice generation progress */}
      {voiceStatus === "generating" && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Bước 1: Tạo giọng nói</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${voiceProgress}%` }}
            ></div>
          </div>
          <p className="text-center text-gray-600">
            Đang tạo giọng nói cho các đoạn hội thoại... {voiceProgress}%
          </p>
        </div>
      )}
      {/* Video creation progress */}
      {isCreating && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Bước 2: Tạo video</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center text-gray-600">
            Đang ghép video với giọng nói... {progress}%
          </p>
        </div>
      )}
      {videoUrl && !showYoutubeShare && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Video đã tạo:</h3>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute top-0 left-0 w-full h-full">
              {/* Always render the video element but conditionally show loading overlay */}
              <video
                controls
                className="w-full h-full rounded-lg"
                onLoadedData={() => {
                  console.log("Video loaded successfully");
                  setIsVideoLoading(true);
                }}
                onError={(e) => {
                  console.error("Video loading error:", e);
                  setError("Không thể tải video. Vui lòng thử lại.");
                }}
              >
                <source src={videoUrl} type="video/mp4" />
                Trình duyệt của bạn không hỗ trợ video.
              </video>

              {/* Overlay loading indicator */}
              {!isVideoLoading && (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-lg">
                  <div className="text-gray-800 font-medium">
                    Đang tải video...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* YouTube sharing success message */}
          {youtubeUrl && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">
                Video đã được chia sẻ lên YouTube!
              </h4>
              <p className="text-sm mb-2">
                Link YouTube của bạn:{" "}
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {youtubeUrl}
                </a>
              </p>
            </div>
          )}

          {/* YouTube sharing button */}
          {videoId && isVideoLoading && !youtubeUrl && (
            <div className="mt-4">
              <button
                onClick={handleShareToYoutube}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium flex items-center mx-auto"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path>
                </svg>
                Chia sẻ lên YouTube
              </button>
            </div>
          )}
        </div>
      )}

      {/* YouTube Sharing Component */}
      {showYoutubeShare && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          {/* Backdrop with blur effect */}
          <div
            className="fixed inset-0 transition-opacity bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={handleYoutubeShareCancel}
          ></div>

          {/* Modal Content */}
          <div className="bg-white rounded-lg shadow-lg z-10 w-full max-w-2xl relative animate-fade-in-up">
            <YouTubeShare
              videoId={videoId}
              videoTitle={videoTitle}
              onComplete={handleYoutubeShareComplete}
              onCancel={handleYoutubeShareCancel}
            />
          </div>
        </div>
      )}
      <div className="flex justify-between mt-4">
        <button
          onClick={onBack}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium"
          disabled={voiceStatus === "generating" || isCreating}
        >
          Quay lại
        </button>

        {videoUrl && !isCreating && !showYoutubeShare && (
          <button
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium"
          >
            Hoàn thành
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoCreation;
