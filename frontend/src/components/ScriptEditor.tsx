import React, { useState } from "react";

interface ScriptEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
  isProcessing,
}) => {
  const [editedContent, setEditedContent] = useState<string>(initialContent);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  const handleSave = () => {
    onSave(editedContent);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4">Chỉnh sửa kịch bản</h2>

      <div className="mb-4">
        <textarea
          className="w-full h-96 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={editedContent}
          onChange={handleChange}
          placeholder="Nhập nội dung kịch bản..."
        ></textarea>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-medium cursor-pointer"
        >
          Hủy bỏ
        </button>
        <button
          onClick={handleSave}
          disabled={isProcessing}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
        >
          {isProcessing ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
};

export default ScriptEditor;
