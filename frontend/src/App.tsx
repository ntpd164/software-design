import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// Định nghĩa các kiểu dữ liệu
interface Style {
  id: string;
  name: string;
}

interface Work {
  title: string;
  author?: string;
  fromWikipedia?: boolean;
  fromDatabase?: boolean;
  inDatabase?: boolean;
  pageid?: number;
  snippet?: string;
  introduction?: string;
  _id?: string;
}

interface PreviewResult {
  success: boolean;
  topic: string;
  style: string;
  preview: string;
  workIds: string[];
}

function App() {
  // State cho các bước trong quy trình
  const [step, setStep] = useState<number>(1);
  const [topic, setTopic] = useState<string>("");
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>("analysis");
  const [searchResults, setSearchResults] = useState<Work[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedWorks, setSelectedWorks] = useState<Work[]>([]);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [savedScriptId, setSavedScriptId] = useState<string>("");
  const [workIds, setWorkIds] = useState<string[]>([]);

  // Lấy danh sách gợi ý và phong cách khi component mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await axios.get("/api/topics/suggestions");
        if (response.data.success) {
          setSuggestedTopics(response.data.topics);
          setStyles(response.data.styles);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setError("Không thể tải thông tin gợi ý");
      }
    };

    fetchSuggestions();
  }, []);

  // Tìm kiếm tác phẩm dựa trên chủ đề
  const searchByTopic = async () => {
    if (!topic.trim()) {
      setError("Vui lòng nhập chủ đề cần tìm");
      return;
    }

    setError("");
    setIsSearching(true);

    try {
      const response = await axios.get(
        `/api/topics/find-works?topic=${encodeURIComponent(topic)}`
      );
      if (response.data.success) {
        const work = response.data.work;
        setSearchResults([work]);
        setSelectedWorks([work]); // Chọn luôn tác phẩm duy nhất

        // Chuyển sang bước 2 để hiển thị thông tin tác phẩm
        setStep(2);
      } else {
        setError("Không tìm thấy tác phẩm liên quan");
      }
    } catch (err) {
      console.error("Error searching by topic:", err);
      setError("Đã xảy ra lỗi khi tìm kiếm");
    } finally {
      setIsSearching(false);
    }
  };

  // Chọn hoặc bỏ chọn tác phẩm
  // const toggleWorkSelection = (work: Work) => {
  //   if (selectedWorks.some((w) => w.title === work.title)) {
  //     setSelectedWorks(selectedWorks.filter((w) => w.title !== work.title));
  //   } else {
  //     setSelectedWorks([...selectedWorks, work]);
  //   }
  // };

  // Tiếp tục sang bước chọn phong cách
  const proceedToStyleSelection = () => {
    if (selectedWorks.length === 0) {
      setError("Vui lòng chọn ít nhất một tác phẩm");
      return;
    }
    setError("");
    setStep(3);
  };

  // Tạo kịch bản xem trước
  const generatePreview = async () => {
    setError("");
    setIsGenerating(true);

    try {
      const response = await axios.post(
        "/api/topics/generate-script",
        {
          topic,
          style: selectedStyle,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const result: PreviewResult = response.data;
        setPreviewContent(result.preview);
        setWorkIds(result.workIds || []);
        setStep(4);
      } else {
        setError("Không thể tạo kịch bản xem trước");
      }
    } catch (err) {
      console.error("Error generating preview:", err);
      setError("Đã xảy ra lỗi khi tạo kịch bản");
    } finally {
      setIsGenerating(false);
    }
  };

  // Lưu kịch bản
  const saveScript = async () => {
    setError("");
    setIsSaving(true);

    try {
      const response = await axios.post("/api/topics/save-script", {
        topic,
        style: selectedStyle,
        content: previewContent,
        workIds,
      });

      if (response.data.success) {
        setSavedScriptId(response.data.scriptId);
        setStep(5);
      } else {
        setError("Không thể lưu kịch bản");
      }
    } catch (err) {
      console.error("Error saving script:", err);
      setError("Đã xảy ra lỗi khi lưu kịch bản");
    } finally {
      setIsSaving(false);
    }
  };

  // Bắt đầu quy trình mới
  const startNewProcess = () => {
    setTopic("");
    setSelectedWorks([]);
    setSelectedStyle("analysis");
    setPreviewContent("");
    setSavedScriptId("");
    setWorkIds([]);
    setError("");
    setStep(1);
  };

  // Quay lại bước trước
  const goBack = () => {
    setError("");
    setStep(step - 1);
  };

  useEffect(() => {
    // Tránh cảnh báo biến không sử dụng
    console.debug("Script ID sẽ được sử dụng sau:", savedScriptId);
  }, [savedScriptId]);

  // Render UI dựa trên bước hiện tại
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Trình tạo video văn học
      </h1>

      {/* Hiển thị thông báo lỗi */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {/* Bước 1: Nhập chủ đề */}
      {step === 1 && (
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium cursor-pointer"
          >
            {isSearching ? "Đang tìm kiếm..." : "Tìm kiếm tác phẩm"}
          </button>
        </div>
      )}

      {/* Bước 2: Xem thông tin tác phẩm */}
      {step === 2 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">
            Tác phẩm phù hợp với chủ đề "{topic}"
          </h2>

          {searchResults.length === 0 ? (
            <p className="text-gray-500">
              Không tìm thấy tác phẩm nào liên quan đến chủ đề
            </p>
          ) : (
            <div className="mb-6">
              <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <h3 className="text-xl font-bold text-blue-800 mb-2">
                  {searchResults[0].title}
                </h3>

                {searchResults[0].author && (
                  <p className="font-medium text-gray-700 mb-3">
                    Tác giả:{" "}
                    <span className="text-blue-700">
                      {searchResults[0].author}
                    </span>
                  </p>
                )}

                {searchResults[0].introduction && (
                  <>
                    <h4 className="font-semibold text-gray-700 mt-3 mb-1">
                      Giới thiệu:
                    </h4>
                    <p className="text-gray-600 whitespace-pre-line">
                      {searchResults[0].introduction}
                    </p>
                  </>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {searchResults[0].introduction && (
                    <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                      Có sẵn trong hệ thống
                    </span>
                  )}
                  {searchResults[0].fromWikipedia && (
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      Dữ liệu từ Wikipedia
                    </span>
                  )}
                </div>
              </div>

              {/* Thêm hướng dẫn giúp người dùng */}
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <p className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    <strong>Không phải tác phẩm bạn đang tìm?</strong> Hãy nhấn{" "}
                    <b>"Quay lại"</b> để trở về bước nhập chủ đề và mô tả chi
                    tiết hơn. Ví dụ: thêm tên tác giả hoặc thời kỳ văn học để có
                    kết quả chính xác hơn.
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={goBack}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded font-medium cursor-pointer"
            >
              Quay lại
            </button>
            <button
              onClick={proceedToStyleSelection}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              Tiếp tục tạo kịch bản
            </button>
          </div>
        </div>
      )}

      {/* Bước 3: Chọn phong cách */}
      {step === 3 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">
            Chọn phong cách nội dung
          </h2>

          {/* Hiển thị thông tin tác phẩm đã chọn */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Tác phẩm đã chọn:</p>
            <p className="font-medium">{selectedWorks[0]?.title}</p>
          </div>

          <div className="mb-6">
            <div className="space-y-3">
              {styles.map((style) => (
                <div key={style.id} className="flex items-center">
                  <input
                    type="radio"
                    id={`style-${style.id}`}
                    name="content-style"
                    checked={selectedStyle === style.id}
                    onChange={() => setSelectedStyle(style.id)}
                    className="mr-2"
                  />
                  <label htmlFor={`style-${style.id}`}>{style.name}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={goBack}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded font-medium cursor-pointer"
            >
              Quay lại
            </button>
            <button
              onClick={generatePreview}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              {isGenerating ? "Đang tạo kịch bản..." : "Tạo kịch bản xem trước"}
            </button>
          </div>
        </div>
      )}

      {/* Bước 4: Xem trước kịch bản */}
      {step === 4 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Xem trước kịch bản</h2>

          <div className="mb-6">
            <div className="border border-gray-300 rounded p-4 bg-gray-50 h-96 overflow-y-auto whitespace-pre-wrap">
              {previewContent}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={goBack}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded font-medium cursor-pointer"
            >
              Quay lại
            </button>
            <button
              onClick={saveScript}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              {isSaving ? "Đang lưu..." : "Lưu kịch bản"}
            </button>
          </div>
        </div>
      )}

      {/* Bước 5: Hoàn thành */}
      {step === 5 && (
        <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6 text-center">
          <div className="text-green-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2">Kịch bản đã được lưu!</h2>
          <p className="mb-4">
            Bạn có thể tiếp tục tạo video hoặc tạo kịch bản mới.
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={startNewProcess}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              Tạo kịch bản mới
            </button>

            <div className="relative group">
              {/* Nút đã được làm mờ */}
              <button
                disabled
                className="bg-green-600 opacity-50 cursor-not-allowed text-white py-2 px-4 rounded font-medium select-none"
                onClick={(e) => e.preventDefault()}
              >
                Tiếp tục tạo video
              </button>

              {/* Tooltip hiển thị khi hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-48 text-center pointer-events-none">
                Chức năng này chưa được triển khai
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
