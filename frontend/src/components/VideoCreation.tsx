import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface VideoCreationProps {
  scriptId: string;
  onBack: () => void;
  onComplete: () => void;
}

const VideoCreation: React.FC<VideoCreationProps> = ({ scriptId, onBack, onComplete }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const getVideoUrl = (relativePath: string) => {
    // If URL starts with http:// or https://, it's already a full URL
    if (
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://")
    ) {
      return relativePath;
    }

    // Point to your actual backend port (3000)
    return `http://localhost:3000${relativePath}`;
  };

  const createVideo = async () => {
    try {
      setIsCreating(true);
      setError('');
      setIsVideoLoading(false);
      setProgress(0);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      const response = await axios.post('/api/video/create-video', {
        scriptId
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.success) {
        setVideoUrl(getVideoUrl(response.data.video.url));
        setIsVideoLoading(true);
      } else {
        setError('Không thể tạo video. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error creating video:', err);
      setError('Đã xảy ra lỗi khi tạo video');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    createVideo();
  }, []);

  const handleDownload = () => {
    if (videoUrl) {
      // Extract filename from videoUrl
      const filename = videoUrl.split('/').pop();
      if (filename) {
        // Use the download API endpoint
        window.location.href = `http://localhost:3000/api/video/download/${filename}`;
      }
    }
  };

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
          Hệ thống sẽ ghép các hình ảnh đã tạo thành một video theo thứ tự. Quá
          trình này có thể mất vài phút.
        </p>
      </div>

      {isCreating && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center text-gray-600">
            Đang tạo video... {progress}%
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Video đã tạo:</h3>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            {isVideoLoading ? (
              <div className="absolute top-0 left-0 w-full h-full">
                <video
                  controls
                  className="w-full h-full rounded-lg"
                  onError={(e) => {
                    console.error("Video loading error:", e);
                    setError("Không thể tải video. Vui lòng thử lại.");
                  }}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Trình duyệt của bạn không hỗ trợ video.
                </video>
              </div>
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-gray-500">Đang tải video...</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium"
        >
          Quay lại
        </button>

        {!isCreating && videoUrl && (
          <div className="space-x-4">
            <button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium"
            >
              Tải video
            </button>
            <button
              onClick={onComplete}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded font-medium"
            >
              Tiếp tục tạo video
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCreation;
