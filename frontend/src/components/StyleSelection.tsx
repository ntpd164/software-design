import React from "react";
import { Style, Work } from "../types";

interface StyleSelectionProps {
  selectedWork: Work;
  styles: Style[];
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  goBack: () => void;
  generatePreview: () => void;
  isGenerating: boolean;
}

const StyleSelection: React.FC<StyleSelectionProps> = ({
  selectedWork,
  styles,
  selectedStyle,
  setSelectedStyle,
  goBack,
  generatePreview,
  isGenerating,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Chọn phong cách nội dung</h2>

      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">Tác phẩm đã chọn:</p>
        <p className="font-medium">{selectedWork.title}</p>
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
  );
};

export default StyleSelection;
