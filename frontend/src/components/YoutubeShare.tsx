import React, { useState } from "react";
import api from "../services/api"; // Use this instead of axios

interface YouTubeShareProps {
  videoId: string;
  videoTitle: string;
  onComplete: (url: string) => void;
  onCancel: () => void;
}

const YouTubeShare: React.FC<YouTubeShareProps> = ({
  videoId,
  videoTitle,
  onComplete,
  onCancel,
}) => {
  const [title, setTitle] = useState(videoTitle || "AI Generated Video");
  const [description, setDescription] = useState(
    "This video was created with an AI video generation tool"
  );
  const [tags, setTags] = useState("AI, video");
  const [privacy, setPrivacy] = useState("unlisted");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  // Handle share button click
  const handleShare = async () => {
    try {
      setIsAuthenticating(true);
      setError("");

      // Get authorization URL
      const response = await api.get("/api/youtube/auth-url");

      if (!response.data.success) {
        throw new Error("Failed to get authorization URL");
      }

      // Store data in localStorage for after auth
      localStorage.setItem(
        "youtubeShareData",
        JSON.stringify({
          videoId,
          title,
          description,
          tags: tags.split(",").map((tag) => tag.trim()),
          privacyStatus: privacy,
        })
      );

      // Open popup window for auth
      const authWindow = window.open(
        response.data.authUrl,
        "YouTubeAuth",
        "width=600,height=700"
      );

      // Listen for message from auth window
      window.addEventListener("message", handleAuthMessage);

      // Check if window closed
      const checkClosed = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkClosed);
          setIsAuthenticating(false);
          window.removeEventListener("message", handleAuthMessage);
        }
      }, 1000);
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Failed to authenticate with YouTube");
      setIsAuthenticating(false);
    }
  };

  // Handle message from auth window
  const handleAuthMessage = async (event) => {
    if (event.data && event.data.type === "YOUTUBE_AUTH_SUCCESS") {
      try {
        // Exchange code for tokens
        const authCodeResponse = await api.post("/api/youtube/auth-code", {
          code: event.data.code,
        });

        if (!authCodeResponse.data.success) {
          throw new Error("Failed to process authentication");
        }

        console.log("Authentication successful!");
        window.removeEventListener("message", handleAuthMessage);

        // Get share data from localStorage
        const shareData = JSON.parse(
          localStorage.getItem("youtubeShareData") || "{}"
        );

        // Start upload process
        await uploadToYouTube(authCodeResponse.data.tokens, shareData);
      } catch (err) {
        console.error("Auth code error:", err);
        setError(err.message || "Failed to complete authentication");
        setIsAuthenticating(false);
      }
    }
  };

  const uploadToYouTube = async (tokens, shareData = null) => {
    try {
      setIsAuthenticating(false);
      setIsUploading(true);
      setUploadProgress(10);

      // Use data from parameters or form state
      const uploadData = shareData || {
        videoId,
        title,
        description,
        tags: tags.split(",").map((tag) => tag.trim()),
        privacyStatus: privacy,
      };

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 2000);

      // Make API call to upload
      const response = await api.post("/api/youtube/upload", {
        ...uploadData,
        tokens,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.data.success) {
        throw new Error(response.data.message || "Upload failed");
      }

      // Clean up localStorage
      localStorage.removeItem("youtubeShareData");

      // Call onComplete with the YouTube URL
      onComplete(response.data.youtubeUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload to YouTube");
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6 mt-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!isAuthenticating && !isUploading && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium mb-2">Chia sẻ lên YouTube</h3>

          <div>
            <label className="block text-gray-700 mb-1">Tiêu đề video</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={4}
            ></textarea>
          </div>

          <div>
            <label className="block text-gray-700 mb-1">
              Tags (phân tách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Quyền riêng tư</label>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="private">Riêng tư</option>
              <option value="unlisted">Không công khai</option>
              <option value="public">Công khai</option>
            </select>
          </div>
        </div>
      )}

      {isAuthenticating && (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang xác thực với YouTube...</p>
        </div>
      )}

      {isUploading && (
        <div className="py-6">
          <h4 className="font-medium mb-2">Đang tải lên YouTube</h4>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-red-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-center text-gray-600">
            {uploadProgress < 100
              ? `Đang tải lên... ${uploadProgress}%`
              : "Hoàn tất!"}
          </p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium"
          disabled={isAuthenticating || isUploading}
        >
          Hủy bỏ
        </button>

        {!isAuthenticating && !isUploading && (
          <button
            onClick={handleShare}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium flex items-center"
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
        )}
      </div>
    </div>
  );
};

export default YouTubeShare;
