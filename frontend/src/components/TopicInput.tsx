import React from "react";

interface TopicInputProps {
  topic: string;
  setTopic: (topic: string) => void;
  suggestedTopics: string[];
  searchByTopic: () => void;
  isSearching: boolean;
}

const TopicInput: React.FC<TopicInputProps> = ({
  topic,
  setTopic,
  suggestedTopics,
  searchByTopic,
  isSearching,
}) => {
  return (
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
  );
};

export default TopicInput;
