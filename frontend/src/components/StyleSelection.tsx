import React from "react";
import { Style, Work } from "../types";

interface StyleSelectionProps {
  selectedWork: Work;
  styles: Style[];
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  isManualMode: boolean;
  setIsManualMode: (isManual: boolean) => void;
  contentParams: ContentParams;
  updateContentParams: (params: Partial<ContentParams>) => void;
  goBack: () => void;
  generatePreview: () => void;
  isGenerating: boolean;
}

export interface ContentParams {
  length: string;
  tone: string;
  complexity: string;
  focusOn: string[];
}

const StyleSelection: React.FC<StyleSelectionProps> = ({
  selectedWork,
  styles,
  selectedStyle,
  setSelectedStyle,
  isManualMode,
  setIsManualMode,
  contentParams,
  updateContentParams,
  goBack,
  generatePreview,
  isGenerating,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4">Chọn phong cách viết</h2>

      <div className="mb-4">
        <p className="font-medium mb-2">
          Tác phẩm: <span className="text-blue-600">{selectedWork.title}</span>
        </p>
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Phong cách:</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {styles.map((style) => (
            <div
              key={style.id}
              className={`border-2 p-3 rounded-lg cursor-pointer ${
                selectedStyle === style.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              onClick={() => setSelectedStyle(style.id)}
            >
              <div className="font-medium">{style.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-4">
          <label className="inline-flex items-center mr-6">
            <input
              type="radio"
              className="form-radio h-5 w-5 text-blue-600"
              checked={!isManualMode}
              onChange={() => setIsManualMode(false)}
            />
            <span className="ml-2">Tự động điều chỉnh nội dung</span>
          </label>

          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio h-5 w-5 text-blue-600"
              checked={isManualMode}
              onChange={() => setIsManualMode(true)}
            />
            <span className="ml-2">Điều chỉnh nội dung thủ công</span>
          </label>
        </div>

        {isManualMode && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-3">Tùy chỉnh nội dung</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Độ dài</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={contentParams.length}
                  onChange={(e) =>
                    updateContentParams({ length: e.target.value })
                  }
                >
                  <option value="short">Ngắn (500-800 từ)</option>
                  <option value="medium">Vừa (800-1200 từ)</option>
                  <option value="long">Dài (1200-2000 từ)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Giọng điệu
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={contentParams.tone}
                  onChange={(e) =>
                    updateContentParams({ tone: e.target.value })
                  }
                >
                  <option value="formal">Học thuật</option>
                  <option value="conversational">Đối thoại</option>
                  <option value="enthusiastic">Nhiệt huyết</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Độ phức tạp
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded"
                value={contentParams.complexity}
                onChange={(e) =>
                  updateContentParams({ complexity: e.target.value })
                }
              >
                <option value="simple">Đơn giản (dành cho học sinh)</option>
                <option value="medium">Trung bình (dành cho sinh viên)</option>
                <option value="complex">
                  Phức tạp (dành cho người chuyên ngành)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tập trung vào
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["themes", "characters", "context", "language"].map(
                  (focus) => (
                    <label key={focus} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600"
                        checked={contentParams.focusOn.includes(focus)}
                        onChange={(e) => {
                          const newFocus = e.target.checked
                            ? [...contentParams.focusOn, focus]
                            : contentParams.focusOn.filter((f) => f !== focus);
                          updateContentParams({ focusOn: newFocus });
                        }}
                      />
                      <span className="ml-2">
                        {focus === "themes" && "Chủ đề"}
                        {focus === "characters" && "Nhân vật"}
                        {focus === "context" && "Bối cảnh"}
                        {focus === "language" && "Ngôn ngữ"}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={goBack}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium cursor-pointer"
        >
          Quay lại
        </button>

        <button
          onClick={generatePreview}
          disabled={isGenerating}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
        >
          {isGenerating ? "Đang tạo..." : "Tạo kịch bản"}
        </button>
      </div>
    </div>
  );
};

export default StyleSelection;
