import React from "react";

interface ScriptPreviewProps {
  previewContent: string;
  goBack: () => void;
  saveScript: () => void;
  isSaving: boolean;
}

const ScriptPreview: React.FC<ScriptPreviewProps> = ({
  previewContent,
  goBack,
  saveScript,
  isSaving,
}) => {
  return (
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
  );
};

export default ScriptPreview;
