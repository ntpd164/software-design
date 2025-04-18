import React, { useState, useEffect } from "react";
import axios from "axios";

interface VideoItem {
  _id: string;
  videoUrl: string;
  title?: string;
  duration: number;
  createdAt: string;
  scriptId?: {
    _id: string;
    topic: string;
  };
}

interface TopicInputProps {
  topic: string;
  setTopic: (topic: string) => void;
  suggestedTopics: string[];
  searchByTopic: () => void;
  isSearching: boolean;
}

const TopicInput: React.FC<TopicInputProps> = ({
  topic,
  setTopic,
  suggestedTopics,
  searchByTopic,
  isSearching,
}) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Fetch all videos when component mounts
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setIsLoadingVideos(true);
        const response = await axios.get("/api/videos");
        if (response.data.success) {
          setVideos(response.data.videos);
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    fetchVideos();
  }, []);

  const getVideoUrl = (relativePath: string) => {
    if (
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://")
    ) {
      return relativePath;
    }
    return `http://localhost:3000${relativePath}`;
  };

  return (
    <div className="rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Nhập chủ đề văn học</h2>

      <div className="mb-4">
        <label htmlFor="topic-input" className="block mb-2">
          Chủ đề:
        </label>
        <input
          id="topic-input"
          type="text"
          className="w-full p-2 border border-gray-600 rounded"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Nhập chủ đề văn học..."
        />
      </div>

      {suggestedTopics.length > 0 && (
        <div className="mb-4">
          <p className="mb-2">Hoặc chọn từ gợi ý:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((suggestedTopic, index) => (
              <button
                key={index}
                onClick={() => setTopic(suggestedTopic)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-3 rounded-full text-sm cursor-pointer"
              >
                {suggestedTopic}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={searchByTopic}
        disabled={isSearching}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium cursor-pointer mb-6"
      >
        {isSearching ? "Đang tìm kiếm..." : "Tìm kiếm tác phẩm"}
      </button>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-3">Video đã tạo</h3>
        {isLoadingVideos ? (
          <div className="text-center py-4">Đang tải danh sách video...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            Chưa có video nào được tạo
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div
                  key={video._id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    className="relative cursor-pointer"
                    // Pass the entire video object rather than just the URL
                    onClick={() => setSelectedVideo(video)}
                  >
                    {/* Video thumbnail (preview) */}
                    <div className="h-32 bg-gray-100 flex items-center justify-center">
                      <div className="text-blue-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                      {Math.floor(video.duration / 60)}:
                      {(video.duration % 60).toString().padStart(2, "0")}
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium truncate">
                      {/* Display title if available, otherwise fall back to topic or default text */}
                      {video.title ||
                        video.scriptId?.topic ||
                        "Video không có chủ đề"}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {new Date(video.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full">
            <div className="p-4 flex justify-between items-center border-b">
              {/* Display the title of the selected video */}
              <h3 className="font-medium">
                {selectedVideo.title ||
                  selectedVideo.scriptId?.topic ||
                  "Video không có chủ đề"}
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="relative" style={{ paddingTop: "56.25%" }}>
              <video
                className="absolute inset-0 w-full h-full"
                src={getVideoUrl(selectedVideo.videoUrl)}
                controls
                autoPlay
              >
                Trình duyệt của bạn không hỗ trợ video.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicInput;
