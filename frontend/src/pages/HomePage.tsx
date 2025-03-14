import React, { useState, useEffect } from "react";
import axios from "axios";
import TopicInput from "../components/TopicInput";
import WorkInfo from "../components/WorkInfo";
import StyleSelection, { ContentParams } from "../components/StyleSelection";
import ScriptPreview from "../components/ScriptPreview";
import { Style, Work, PreviewResult } from "../types";

const HomePage: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [topic, setTopic] = useState<string>("");
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>("analysis");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedWorks, setSelectedWorks] = useState<Work[]>([]);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [workIds, setWorkIds] = useState<string[]>([]);

  // New state for content adjustment features
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [contentParams, setContentParams] = useState<ContentParams>({
    length: "medium",
    tone: "formal",
    complexity: "medium",
    focusOn: ["themes", "characters"],
  });
  const [scriptStatus, setScriptStatus] = useState<string>("draft"); // draft, approved

  const updateContentParams = (params: Partial<ContentParams>) => {
    setContentParams((prev) => ({
      ...prev,
      ...params,
    }));
  };

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
        setSelectedWorks([work]);
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

  const proceedToStyleSelection = () => {
    if (selectedWorks.length === 0) {
      setError("Vui lòng chọn ít nhất một tác phẩm");
      return;
    }
    setError("");
    setStep(3);
  };

  const generatePreview = async () => {
    setError("");
    setIsGenerating(true);

    try {
      const requestData = {
        topic,
        style: selectedStyle,
        // Include manual mode parameters if enabled
        ...(isManualMode && { contentParams }),
        isManualMode,
      };

      const response = await axios.post(
        "/api/topics/generate-script",
        requestData,
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
        setScriptStatus("draft");
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

  const saveScript = async (content: string, isApproved: boolean) => {
    setError("");
    setIsSaving(true);

    try {
      const response = await axios.post("/api/topics/save-script", {
        topic,
        style: selectedStyle,
        content,
        workIds,
        status: isApproved ? "approved" : "draft",
        contentParams: isManualMode ? contentParams : undefined,
      });

      if (response.data.success) {
        setScriptStatus(isApproved ? "approved" : "draft");
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

  const startNewProcess = () => {
    setTopic("");
    setSelectedWorks([]);
    setSelectedStyle("analysis");
    setPreviewContent("");
    setWorkIds([]);
    setIsManualMode(false);
    setContentParams({
      length: "medium",
      tone: "formal",
      complexity: "medium",
      focusOn: ["themes", "characters"],
    });
    setScriptStatus("draft");
    setError("");
    setStep(1);
  };

  const goBack = () => {
    setError("");
    setStep(step - 1);
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Trình tạo video văn học
      </h1>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {step === 1 && (
        <TopicInput
          topic={topic}
          setTopic={setTopic}
          suggestedTopics={suggestedTopics}
          searchByTopic={searchByTopic}
          isSearching={isSearching}
        />
      )}

      {step === 2 && selectedWorks[0] && (
        <WorkInfo
          work={selectedWorks[0]}
          goBack={goBack}
          proceedToStyleSelection={proceedToStyleSelection}
        />
      )}

      {step === 3 && selectedWorks[0] && (
        <StyleSelection
          selectedWork={selectedWorks[0]}
          styles={styles}
          selectedStyle={selectedStyle}
          setSelectedStyle={setSelectedStyle}
          isManualMode={isManualMode}
          setIsManualMode={setIsManualMode}
          contentParams={contentParams}
          updateContentParams={updateContentParams}
          goBack={goBack}
          generatePreview={generatePreview}
          isGenerating={isGenerating}
        />
      )}

      {step === 4 && (
        <ScriptPreview
          previewContent={previewContent}
          goBack={goBack}
          saveScript={saveScript}
          isSaving={isSaving}
        />
      )}

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
            {scriptStatus === "approved"
              ? "Kịch bản đã được phê duyệt và sẵn sàng để tạo video."
              : "Kịch bản đã được lưu như bản nháp. Bạn có thể chỉnh sửa và phê duyệt sau."}
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={startNewProcess}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              Tạo kịch bản mới
            </button>

            {scriptStatus === "approved" ? (
              <div className="relative group">
                <button
                  disabled
                  className="bg-green-600 opacity-50 cursor-not-allowed text-white py-2 px-4 rounded font-medium select-none"
                  onClick={(e) => e.preventDefault()}
                >
                  Tiếp tục tạo video
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-48 text-center pointer-events-none">
                  Chức năng này chưa được triển khai
                </div>
              </div>
            ) : (
              <div className="relative group">
                <button
                  disabled
                  className="bg-green-600 opacity-50 cursor-not-allowed text-white py-2 px-4 rounded font-medium select-none"
                  onClick={(e) => e.preventDefault()}
                >
                  Tiếp tục tạo video
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-48 text-center pointer-events-none">
                  Cần phê duyệt kịch bản trước
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
