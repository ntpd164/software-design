import React, { useState, useRef} from "react";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import axios from "axios";

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageBlob: Blob) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  imageUrl,
  onSave,
  onCancel,
}) => {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);

  // Hàm lưu đơn giản hóa - gửi yêu cầu xử lý ảnh đến server
  const handleSave = async () => {
    setIsProcessing(true);

    try {
      // Nếu không có ảnh hoặc crop, không làm gì cả
      if (!imgRef.current || !completedCrop || !originalImageDimensions) {
        throw new Error("Không có ảnh hoặc vùng cắt hoặc kích thước ảnh");
      }

      // Tính toán tỷ lệ giữa kích thước hiển thị và kích thước thật của ảnh
      const displayedImage = imgRef.current;
      const scaleX = originalImageDimensions.width / displayedImage.width;
      const scaleY = originalImageDimensions.height / displayedImage.height;

      // Tính toán vị trí và kích thước cắt theo pixel thực
      let cropData;
      if (completedCrop.unit === "%") {
        // Nếu đơn vị là phần trăm, tính toán pixel dựa trên kích thước gốc
        cropData = {
          x: Math.round(
            (completedCrop.x / 100) * originalImageDimensions.width
          ),
          y: Math.round(
            (completedCrop.y / 100) * originalImageDimensions.height
          ),
          width: Math.round(
            (completedCrop.width / 100) * originalImageDimensions.width
          ),
          height: Math.round(
            (completedCrop.height / 100) * originalImageDimensions.height
          ),
          unit: "px",
        };
      } else {
        // Nếu đơn vị là pixel, điều chỉnh theo tỷ lệ
        cropData = {
          x: Math.round(completedCrop.x * scaleX),
          y: Math.round(completedCrop.y * scaleY),
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY),
          unit: "px",
        };
      }

      // 1. Tạo dữ liệu để gửi đến server
      const imageData = {
        imageUrl: imageUrl, // URL ảnh gốc
        originalDimensions: originalImageDimensions, // Thêm kích thước gốc
        crop: cropData, // Dùng dữ liệu cắt đã được điều chỉnh
        filters: {
          brightness: brightness,
          contrast: contrast,
          saturation: saturation,
        },
      };

      console.log("Sending image data to server:", JSON.stringify(imageData));

      // 2. Gửi yêu cầu đến API endpoint server-side để xử lý ảnh
      const response = await axios.post("/api/images/edit", imageData, {
        responseType: "blob",
      });

      // 3. Nhận lại blob đã xử lý và gọi hàm onSave
      const editedBlob = response.data;
      onSave(editedBlob);
    } catch (error) {
      console.error("Lỗi khi lưu ảnh đã chỉnh sửa:", error);
      alert("Không thể lưu ảnh đã chỉnh sửa. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;

    // Lưu kích thước gốc của ảnh
    const img = e.currentTarget;
    setOriginalImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });

    // Set initial crop once the image is loaded
    setCrop({
      unit: "%",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });

    // Set initial completed crop for preview
    setCompletedCrop({
      unit: "%",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
  };

  const handleImageError = () => {
    console.error("Error loading image for editing:", imageUrl);
    setImageError(true);
  };

  // Generate filters CSS for the image preview
  const imageStyle = {
    maxHeight: "50vh",
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
  };

  return (
    <div className="bg-white p-4">
      <h3 className="font-bold text-xl mb-4">Chỉnh sửa hình ảnh</h3>

      {imageError ? (
        <div className="text-center p-4 bg-red-100 text-red-700 rounded mb-4">
          <p>Không thể tải ảnh để chỉnh sửa. Vui lòng thử lại sau.</p>
          <img
            src={imageUrl}
            alt="Preview"
            className="max-h-[40vh] mx-auto mt-4"
          />
        </div>
      ) : (
        <div className="mb-4">
          <ReactCrop
            crop={crop}
            onChange={(newCrop) => setCrop(newCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[50vh] mx-auto"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageUrl}
              onLoad={onImageLoad}
              onError={handleImageError}
              style={imageStyle}
              // Đã xóa crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 mt-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Độ sáng: {brightness}%
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Độ tương phản: {contrast}%
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Độ bão hòa: {saturation}%
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={saturation}
            onChange={(e) => setSaturation(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <button
          onClick={onCancel}
          className="py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          disabled={isProcessing}
        >
          Hủy
        </button>
        <button
          onClick={handleSave}
          className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Đang lưu...
            </>
          ) : (
            "Lưu"
          )}
        </button>
      </div>
    </div>
  );
};

export default ImageEditor;
