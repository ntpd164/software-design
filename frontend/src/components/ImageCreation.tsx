import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Image } from "../types";

// Image style type
type ImageStyle = {
  id: string;
  name: string;
  description: string;
  styleModifier: string;
};

// API response type
interface ImageResponse {
  _id: string;
  scriptId?: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  metadata?: {
    model?: string;
    index?: number;
    style?: string;
  };
}

interface ImageCreationProps {
  scriptId: string;
  onBack: () => void;
  onContinue: () => void;
  imageStyles: ImageStyle[];
  selectedImageStyle: string | null;
  setSelectedImageStyle: (styleId: string | null) => void;
  isGeneratingImages: boolean;
  setIsGeneratingImages: (isGenerating: boolean) => void;
  generatedImages: Image[];
  setGeneratedImages: React.Dispatch<React.SetStateAction<Image[]>>;
  imageError: string;
  setImageError: (error: string) => void;
}

const ImageCreation: React.FC<ImageCreationProps> = ({
  scriptId,
  onBack,
  onContinue,
  imageStyles,
  selectedImageStyle,
  setSelectedImageStyle,
  isGeneratingImages,
  setIsGeneratingImages,
  generatedImages,
  setGeneratedImages,
  imageError,
  setImageError,
}) => {
  // Add state for image preview
  const [previewImage, setPreviewImage] = useState<Image | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState<number>(0);
  type TimeoutId = ReturnType<typeof setTimeout>;
  const [pollingInterval, setPollingInterval] = useState<TimeoutId | null>(
    null
  );
  const [regeneratingImages, setRegeneratingImages] = useState<
    Record<string, boolean>
  >({});
  // Add these state variables and ref
  const [uploadingImages, setUploadingImages] = useState<
    Record<string, boolean>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  // Helper function to get correct image URL
  const getImageUrl = (relativePath: string) => {
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

  // Updated fetchImages function to prevent browser caching of regenerated images
  const fetchImages = useCallback(async () => {
    if (!scriptId) return;

    try {
      const response = await axios.get(`/api/images/script/${scriptId}`);
      console.log("Image response:", response.data);

      if (response.data.success) {
        // Add timestamp to image URLs to prevent caching issues
        const images: Image[] = response.data.data.map(
          (img: ImageResponse) => ({
            _id: img._id,
            scriptId: img.scriptId || scriptId,
            // Add cache-busting parameter
            imageUrl: `${getImageUrl(img.imageUrl)}?t=${Date.now()}`,
            prompt: img.prompt,
            createdAt: img.createdAt,
          })
        );

        setGeneratedImages(images);

        // Update progress tracking
        if (isGeneratingImages) {
          setGenerationProgress(images.length);

          // Check if generation is complete
          if (
            totalImagesToGenerate > 0 &&
            images.length >= totalImagesToGenerate
          ) {
            console.log("Image generation complete! Stopping polling.");
            setIsGeneratingImages(false);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching images:", err);
      setImageError("Không thể tải hình ảnh");

      // Also stop generation on error to prevent loading spinner from being stuck
      if (isGeneratingImages) {
        setIsGeneratingImages(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    }
  }, [
    scriptId,
    setGeneratedImages,
    setImageError,
    pollingInterval,
    isGeneratingImages,
    totalImagesToGenerate,
    setIsGeneratingImages,
  ]);

  // Initial fetch of images when component mounts
  useEffect(() => {
    fetchImages();

    // Return cleanup function
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style selection handler - just selects the style without generating
  const selectImageStyle = (styleId: string) => {
    // Don't allow changing style during generation
    if (!isGeneratingImages) {
      setSelectedImageStyle(styleId);
    }
  };

  // Generate images button handler
  const startImageGeneration = async () => {
    if (!scriptId || !selectedImageStyle) return;

    const selectedStyle = imageStyles.find(
      (style) => style.id === selectedImageStyle
    );
    if (!selectedStyle) return;

    setIsGeneratingImages(true);
    setImageError("");
    setGenerationProgress(0);

    try {
      // Start the generation process
      const response = await axios.post(`/api/images/generate/${scriptId}`, {
        style: selectedStyle.styleModifier,
      });

      if (response.data.success) {
        // Set expected number of images
        if (response.data.data.totalProcessed) {
          setTotalImagesToGenerate(response.data.data.totalProcessed);
        }

        // Start polling for new images every 2 seconds
        const interval = setInterval(() => {
          fetchImages();
        }, 2000);

        setPollingInterval(interval);

        // Fetch immediately to start showing images
        fetchImages();
      } else {
        setImageError("Không thể tạo hình ảnh");
        setIsGeneratingImages(false);
      }
    } catch (err: unknown) {
      console.error("Error generating images:", err);
      // Type guard for error with response property
      if (err && typeof err === "object" && "response" in err) {
        const errorWithResponse = err as {
          response?: { data?: { message?: string } };
        };
        setImageError(
          errorWithResponse.response?.data?.message ||
            "Đã xảy ra lỗi khi tạo hình ảnh"
        );
      } else {
        setImageError("Đã xảy ra lỗi khi tạo hình ảnh");
      }
      setIsGeneratingImages(false);
    }
  };

  // Add progress tracking mechanism
  useEffect(() => {
    if (isGeneratingImages && totalImagesToGenerate > 0) {
      setGenerationProgress(generatedImages.length);

      // Check if we've reached the target number of images
      if (generatedImages.length >= totalImagesToGenerate) {
        console.log("Detected all images generated, stopping polling");
        setIsGeneratingImages(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    }
  }, [
    generatedImages.length,
    isGeneratingImages,
    totalImagesToGenerate,
    pollingInterval,
    setIsGeneratingImages,
  ]);

  const regenerateImage = async (imageId: string, prompt: string) => {
    if (!scriptId || !selectedImageStyle) return;

    // Find the selected style
    const selectedStyle = imageStyles.find(
      (style) => style.id === selectedImageStyle
    );
    if (!selectedStyle) return;

    // Update regenerating state
    setRegeneratingImages((prev) => ({ ...prev, [imageId]: true }));
    setImageError("");

    try {
      // Call API to regenerate the specific image
      const response = await axios.post(`/api/images/regenerate/${scriptId}`, {
        imageId,
        prompt,
        style: selectedStyle.styleModifier,
      });

      if (response.data.success) {
        // Fetch the updated image list
        fetchImages();
      } else {
        setImageError(
          `Không thể tạo lại hình ảnh: ${
            response.data.message || "Lỗi không xác định"
          }`
        );
      }
    } catch (err: unknown) {
      console.error("Error regenerating image:", err);
      if (err && typeof err === "object" && "response" in err) {
        const errorWithResponse = err as {
          response?: { data?: { message?: string } };
        };
        setImageError(
          errorWithResponse.response?.data?.message ||
            "Đã xảy ra lỗi khi tạo lại hình ảnh"
        );
      } else {
        setImageError("Đã xảy ra lỗi khi tạo lại hình ảnh");
      }
    } finally {
      setRegeneratingImages((prev) => ({ ...prev, [imageId]: false }));
    }
  };

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const openImagePreview = (image: Image) => {
    setPreviewImage(image);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  // Function to manually stop generation
  const stopGeneration = () => {
    setIsGeneratingImages(false);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    console.log("Image generation manually stopped");
  };

  // Add these functions to handle image uploads
  const handleImageUpload = async (imageId: string, file: File) => {
    if (!scriptId) return;

    // Set uploading state for this specific image
    setUploadingImages((prev) => ({ ...prev, [imageId]: true }));
    setImageError("");

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append("image", file);
      formData.append("scriptId", scriptId);
      formData.append("imageId", imageId);

      // Upload the file
      const response = await axios.post(
        `/api/images/upload/${scriptId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        // Refresh the images to show the new uploaded one
        fetchImages();
      } else {
        setImageError(
          `Không thể tải lên hình ảnh: ${
            response.data.message || "Lỗi không xác định"
          }`
        );
      }
    } catch (err: unknown) {
      console.error("Error uploading image:", err);
      if (err && typeof err === "object" && "response" in err) {
        const errorWithResponse = err as {
          response?: { data?: { message?: string } };
        };
        setImageError(
          errorWithResponse.response?.data?.message ||
            "Đã xảy ra lỗi khi tải lên hình ảnh"
        );
      } else {
        setImageError("Đã xảy ra lỗi khi tải lên hình ảnh");
      }
    } finally {
      // Clear uploading state
      setUploadingImages((prev) => ({ ...prev, [imageId]: false }));
    }
  };

  // Function to trigger file selector when upload button is clicked
  const openFileSelector = (imageId: string) => {
    setActiveImageId(imageId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection from file dialog
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && activeImageId) {
      handleImageUpload(activeImageId, files[0]);
    }

    // Reset file input
    if (e.target) {
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">
        Tạo hình ảnh minh họa
      </h2>

      {imageError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{imageError}</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Chọn phong cách hình ảnh</h3>
        <p className="text-gray-600 mb-4">
          Chọn phong cách để tạo hình ảnh minh họa cho kịch bản của bạn
        </p>

        <div className="flex flex-col space-y-4">
          {/* Style Dropdown/Spinner */}
          <div className="relative">
            <select
              id="image-style-select"
              className={`block appearance-none w-full bg-white border ${
                selectedImageStyle ? "border-blue-500" : "border-gray-300"
              } hover:border-blue-500 px-4 py-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                isGeneratingImages
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              value={selectedImageStyle || ""}
              onChange={(e) => selectImageStyle(e.target.value)}
              disabled={isGeneratingImages}
            >
              <option value="" disabled>
                -- Chọn phong cách hình ảnh --
              </option>
              {imageStyles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg
                className="fill-current h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>

          {/* Show description of selected style */}
          {selectedImageStyle && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-1">
                {
                  imageStyles.find((style) => style.id === selectedImageStyle)
                    ?.name
                }
              </h4>
              <p className="text-blue-700 text-sm">
                {
                  imageStyles.find((style) => style.id === selectedImageStyle)
                    ?.description
                }
              </p>
            </div>
          )}

          {/* Generate Images Button */}
          {selectedImageStyle && !isGeneratingImages && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={startImageGeneration}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium flex items-center w-full justify-center sm:w-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
                Tạo hình ảnh với phong cách này
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold">Hình ảnh đã tạo</h3>
          {generatedImages.length > 0 && (
            <span className="text-gray-500 text-sm">
              {generatedImages.length} hình ảnh
              {isGeneratingImages && totalImagesToGenerate > 0 && (
                <>
                  {" "}
                  ({generationProgress}/{totalImagesToGenerate})
                </>
              )}
            </span>
          )}
        </div>

        {isGeneratingImages ? (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 text-center">
                Đang tạo hình ảnh...
                {totalImagesToGenerate > 0 && (
                  <span className="block mt-1 text-sm">
                    Hình ảnh đã tạo: {generationProgress}/
                    {totalImagesToGenerate}
                  </span>
                )}
              </p>

              {/* Manual stop button */}
              <button
                onClick={stopGeneration}
                className="mt-3 text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Dừng quá trình tạo
              </button>
            </div>

            {/* Show images that have already been generated */}
            {generatedImages.length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-medium mb-3 text-gray-700">
                  Hình ảnh đang được tạo:
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((image) => (
                    <div
                      key={image._id}
                      className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative"
                    >
                      <div className="h-40 bg-gray-100 relative">
                        <img
                          src={image.imageUrl}
                          alt={image.prompt.substring(0, 30)}
                          className={`w-full h-full object-cover ${
                            regeneratingImages[image._id] ? "opacity-40" : ""
                          }`}
                          onLoad={() =>
                            console.log(
                              "Image loaded successfully:",
                              image.imageUrl
                            )
                          }
                          onError={(e) => {
                            console.error(
                              "Image failed to load:",
                              image.imageUrl
                            );
                            e.currentTarget.src =
                              "https://via.placeholder.com/300x200?text=Image+Not+Found";
                          }}
                        />

                        {/* Loading overlay for regenerating images */}
                        {regeneratingImages[image._id] && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        )}

                        {/* Image controls */}
                        <div className="absolute top-2 right-2 flex space-x-1">
                          {/* Upload button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening preview
                              openFileSelector(image._id);
                            }}
                            disabled={
                              uploadingImages[image._id] ||
                              regeneratingImages[image._id] ||
                              isGeneratingImages
                            }
                            className={`p-1.5 rounded-full ${
                              uploadingImages[image._id] ||
                              regeneratingImages[image._id] ||
                              isGeneratingImages
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-600"
                            } text-white shadow-md`}
                            title="Tải lên hình ảnh thay thế"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                              />
                            </svg>
                          </button>

                          {/* Regenerate button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening preview
                              regenerateImage(image._id, image.prompt);
                            }}
                            disabled={
                              regeneratingImages[image._id] ||
                              isGeneratingImages
                            }
                            className={`p-1.5 rounded-full ${
                              regeneratingImages[image._id] ||
                              isGeneratingImages
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-blue-500 hover:bg-blue-600"
                            } text-white shadow-md`}
                            title="Tạo lại hình ảnh này"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-500 truncate">
                          {image.prompt.substring(0, 60)}
                          {image.prompt.length > 60 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : generatedImages.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">
              Chưa có hình ảnh nào. Hãy chọn phong cách và nhấn "Tạo hình ảnh"
              để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {generatedImages.map((image) => (
              <div
                key={image._id}
                className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative"
              >
                <div
                  className="h-40 bg-gray-100 relative"
                  onClick={() => openImagePreview(image)}
                >
                  <img
                    src={image.imageUrl}
                    alt={image.prompt.substring(0, 30)}
                    className={`w-full h-full object-cover ${
                      regeneratingImages[image._id] ? "opacity-40" : ""
                    }`}
                    onLoad={() =>
                      console.log("Image loaded successfully:", image.imageUrl)
                    }
                    onError={(e) => {
                      console.error("Image failed to load:", image.imageUrl);
                      e.currentTarget.src =
                        "https://via.placeholder.com/300x200?text=Image+Not+Found";
                    }}
                  />

                  {/* Loading overlay for regenerating images */}
                  {regeneratingImages[image._id] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  )}

                  {/* Image controls */}
                  <div className="absolute top-2 right-2 flex space-x-1">
                    {/* Upload button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening preview
                        openFileSelector(image._id);
                      }}
                      disabled={
                        uploadingImages[image._id] ||
                        regeneratingImages[image._id] ||
                        isGeneratingImages
                      }
                      className={`p-1.5 rounded-full ${
                        uploadingImages[image._id] ||
                        regeneratingImages[image._id] ||
                        isGeneratingImages
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-green-500 hover:bg-green-600"
                      } text-white shadow-md`}
                      title="Tải lên hình ảnh thay thế"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                    </button>

                    {/* Regenerate button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening preview
                        regenerateImage(image._id, image.prompt);
                      }}
                      disabled={regeneratingImages[image._id]}
                      className={`p-1.5 rounded-full ${
                        regeneratingImages[image._id]
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600"
                      } text-white shadow-md`}
                      title="Tạo lại hình ảnh này"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-2" onClick={() => openImagePreview(image)}>
                  <p className="text-xs text-gray-500 truncate">
                    {image.prompt.substring(0, 60)}
                    {image.prompt.length > 60 ? "..." : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(
                      image.updatedAt || image.createdAt
                    ).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={closeImagePreview}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">Chi tiết hình ảnh</h3>
              <div className="flex space-x-2">
                {/* Upload button in preview */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileSelector(previewImage._id);
                    closeImagePreview();
                  }}
                  disabled={
                    uploadingImages[previewImage._id] ||
                    regeneratingImages[previewImage._id]
                  }
                  className={`${
                    uploadingImages[previewImage._id] ||
                    regeneratingImages[previewImage._id]
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600"
                  } text-white py-1 px-2 rounded flex items-center text-sm`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Tải lên
                </button>

                {/* Regenerate button in preview */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    regenerateImage(previewImage._id, previewImage.prompt);
                    closeImagePreview();
                  }}
                  disabled={regeneratingImages[previewImage._id]}
                  className={`${
                    regeneratingImages[previewImage._id]
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white py-1 px-2 rounded flex items-center text-sm`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Tạo lại
                </button>
                {/* Close button */}
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={closeImagePreview}
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
            </div>
            <div className="p-4">
              <img
                src={previewImage.imageUrl}
                alt={previewImage.prompt}
                className="w-full max-h-[60vh] object-contain mb-4"
                onError={(e) => {
                  console.error(
                    "Image failed to load in preview:",
                    previewImage.imageUrl
                  );
                  e.currentTarget.src =
                    "https://via.placeholder.com/800x600?text=Image+Not+Found";
                }}
              />
              <div className="bg-gray-50 p-3 rounded-lg mt-3">
                <h4 className="font-semibold mb-1 text-sm">Mô tả:</h4>
                <p className="text-gray-700 whitespace-pre-line text-sm">
                  {previewImage.prompt}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Tạo lúc:{" "}
                  {new Date(
                    previewImage.updatedAt || previewImage.createdAt
                  ).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium"
        >
          Quay lại
        </button>

        <button
          onClick={onContinue}
          disabled={generatedImages.length === 0 || isGeneratingImages}
          className={`${
            generatedImages.length > 0 && !isGeneratingImages
              ? "bg-green-600 hover:bg-green-700"
              : "bg-green-400 cursor-not-allowed"
          } text-white py-2 px-4 rounded font-medium`}
        >
          Tiếp tục tạo video
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelected}
        style={{ display: "none" }}
        accept="image/jpeg,image/png,image/gif,image/webp"
      />
    </div>
  );
};

export default ImageCreation;
