import React from "react";
import { Work } from "../types";

interface WorkInfoProps {
  work: Work;
  goBack: () => void;
  proceedToStyleSelection: () => void;
}

const WorkInfo: React.FC<WorkInfoProps> = ({
  work,
  goBack,
  proceedToStyleSelection,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">
        Tác phẩm phù hợp với chủ đề "{work.title}"
      </h2>

      <div className="mb-6">
        <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="text-xl font-bold text-blue-800 mb-2">{work.title}</h3>

          {work.author && (
            <p className="font-medium text-gray-700 mb-3">
              Tác giả: <span className="text-blue-700">{work.author}</span>
            </p>
          )}

          {work.introduction && (
            <>
              <h4 className="font-semibold text-gray-700 mt-3 mb-1">
                Giới thiệu:
              </h4>
              <p className="text-gray-600 whitespace-pre-line">
                {work.introduction}
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {work.introduction && (
              <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                Có sẵn trong hệ thống
              </span>
            )}
            {/* {work.fromWikipedia && (
              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                Dữ liệu từ Wikipedia
              </span>
            )} */}
          </div>
        </div>

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
              <b>"Quay lại"</b> để trở về bước nhập chủ đề và mô tả chi tiết
              hơn. Ví dụ: thêm tên tác giả hoặc thời kỳ văn học để có kết quả
              chính xác hơn.
            </span>
          </p>
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
          onClick={proceedToStyleSelection}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium cursor-pointer"
        >
          Tiếp tục tạo kịch bản
        </button>
      </div>
    </div>
  );
};

export default WorkInfo;
