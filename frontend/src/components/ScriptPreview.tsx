import React, { useState } from "react";
import ScriptEditor from "./ScriptEditor";

interface ScriptPreviewProps {
  previewContent: string;
  goBack: () => void;
  saveScript: (content: string, isApproved: boolean) => void;
  isSaving: boolean;
}

const ScriptPreview: React.FC<ScriptPreviewProps> = ({
  previewContent,
  goBack,
  saveScript,
  isSaving,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentContent, setCurrentContent] = useState<string>(previewContent);

  const handleSaveEdit = (editedContent: string) => {
    setCurrentContent(editedContent);
    setIsEditing(false);
  };

  const handleSave = (approved: boolean) => {
    saveScript(currentContent, approved);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      {isEditing ? (
        <ScriptEditor
          initialContent={currentContent}
          onSave={handleSaveEdit}
          onCancel={() => setIsEditing(false)}
          isProcessing={false}
        />
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">Xem trước kịch bản</h2>

          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap overflow-auto h-96">
            {currentContent}
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <button
              onClick={goBack}
              className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium cursor-pointer"
            >
              Quay lại
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded font-medium cursor-pointer"
              >
                Chỉnh sửa
              </button>

              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
              >
                {isSaving ? "Đang lưu..." : "Lưu nháp"}
              </button>

              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
              >
                {isSaving ? "Đang lưu..." : "Phê duyệt và tạo video"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScriptPreview;
