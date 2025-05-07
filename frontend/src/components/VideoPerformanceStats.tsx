import React, { useState, useEffect } from "react";
import axios from "axios";

interface PeriodStats {
  period: string;
  displayLabel: string;
  count: number;
  totalDuration: number;
  videos: {
    id: string;
    title: string;
    duration: number;
    createdAt: string;
  }[];
}

interface VideoStats {
  periodStats: PeriodStats[];
  totalVideos: number;
  averageDuration: number;
  oldestVideo: {
    id: string;
    title: string;
    duration: number;
    createdAt: string;
  } | null;
  newestVideo: {
    id: string;
    title: string;
    duration: number;
    createdAt: string;
  } | null;
  groupBy: "day" | "week" | "month";
}

interface VideoPerformanceStatsProps {
  onClose: () => void;
}

const VideoPerformanceStats: React.FC<VideoPerformanceStatsProps> = ({
  onClose,
}) => {
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `/api/statistics/video-performance?groupBy=${groupBy}`
        );
        if (response.data.success) {
          setStats(response.data.stats);
        } else {
          setError("Không thể tải dữ liệu thống kê");
        }
      } catch (error) {
        console.error("Failed to fetch statistics:", error);
        setError("Đã xảy ra lỗi khi tải dữ liệu thống kê");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [groupBy]);

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Format date to Vietnamese format
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  // Calculate the maximum count for scaling the chart
  const maxCount = stats
    ? Math.max(...stats.periodStats.map((period) => period.count))
    : 0;

  // Get the appropriate title based on groupBy
  const getChartTitle = () => {
    switch (stats?.groupBy) {
      case "week":
        return "Biểu đồ tạo video theo tuần";
      case "month":
        return "Biểu đồ tạo video theo tháng";
      default:
        return "Biểu đồ tạo video theo ngày";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 flex justify-between items-center border-b">
          <h2 className="text-xl font-semibold">
            Thống kê hiệu suất tạo video
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900"
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

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p>Đang tải dữ liệu thống kê...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : stats && stats.totalVideos > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-1">Tổng số video</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.totalVideos}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-1">
                    Thời lượng trung bình
                  </h3>
                  <p className="text-3xl font-bold text-green-600">
                    {formatDuration(stats.averageDuration)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-1">Video mới nhất</h3>
                  <p className="text-xl font-bold text-purple-600 truncate">
                    {stats.newestVideo?.title || "Không có tiêu đề"}
                  </p>
                  <p className="text-sm text-purple-500">
                    {formatDate(stats.newestVideo?.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">{getChartTitle()}</h3>
                <div className="flex border border-gray-300 rounded overflow-hidden">
                  <button
                    onClick={() => setGroupBy("day")}
                    className={`px-3 py-1 text-sm ${
                      stats.groupBy === "day"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    Ngày
                  </button>
                  <button
                    onClick={() => setGroupBy("week")}
                    className={`px-3 py-1 text-sm ${
                      stats.groupBy === "week"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    Tuần
                  </button>
                  <button
                    onClick={() => setGroupBy("month")}
                    className={`px-3 py-1 text-sm ${
                      stats.groupBy === "month"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    Tháng
                  </button>
                </div>
              </div>

              {stats.periodStats.length > 0 ? (
                <div className="mb-8 border border-gray-200 rounded-lg p-4 bg-white">
                  {/* Chart grid lines */}
                  <div className="relative h-[180px] mb-2">
                    <div className="absolute inset-0">
                      <div className="grid grid-cols-1 grid-rows-4 h-full">
                        <div className="border-t border-gray-200"></div>
                        <div className="border-t border-gray-200"></div>
                        <div className="border-t border-gray-200"></div>
                        <div className="border-t border-gray-200"></div>
                      </div>
                    </div>

                    {/* Chart bars */}
                    <div className="absolute inset-0 flex items-end justify-around">
                      {stats.periodStats.map((period) => (
                        <div
                          key={period.period}
                          className="flex flex-col items-center"
                          style={{
                            width: `${100 / stats.periodStats.length}%`,
                            maxWidth: "100px",
                          }}
                        >
                          <div
                            className="bg-blue-500 w-12 rounded-t-md transition-all duration-500 ease-in-out relative group"
                            style={{
                              height: `${(period.count / maxCount) * 150}px`,
                              minHeight: "20px",
                            }}
                          >
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {period.count} video (
                              {formatDuration(period.totalDuration)})
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* X-axis labels */}
                  <div className="flex justify-around mt-2">
                    {stats.periodStats.map((period) => (
                      <div
                        key={period.period}
                        className="text-xs text-center"
                        style={{
                          width: `${100 / stats.periodStats.length}%`,
                          maxWidth: "100px",
                        }}
                      >
                        <div className="font-medium">{period.displayLabel}</div>
                        <div className="text-gray-500">
                          {period.count} video
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 mb-8">
                  Không có đủ dữ liệu để hiển thị biểu đồ
                </p>
              )}

              <h3 className="text-lg font-medium mb-4">
                Chi tiết video theo{" "}
                {stats.groupBy === "day"
                  ? "ngày"
                  : stats.groupBy === "week"
                  ? "tuần"
                  : "tháng"}
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full bg-white table-fixed">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                    <col className="w-[30%]" />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-6 border-b border-gray-200 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        {stats.groupBy === "day"
                          ? "Ngày"
                          : stats.groupBy === "week"
                          ? "Tuần"
                          : "Tháng"}
                      </th>
                      <th className="py-3 px-6 border-b border-gray-200 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Số lượng
                      </th>
                      <th className="py-3 px-6 border-b border-gray-200 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Tổng thời lượng
                      </th>
                      <th className="py-3 px-6 border-b border-gray-200 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Video đã tạo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.periodStats.map((period) => (
                      <tr key={period.period} className="hover:bg-gray-50">
                        <td className="py-3 px-6 text-sm font-medium text-gray-900 text-center">
                          {period.displayLabel}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-900 text-center">
                          {period.count}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-900 text-center">
                          {formatDuration(period.totalDuration)}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-900 text-center">
                          <div className="mx-auto max-w-fit">
                            <ul className="list-disc text-left pl-5 space-y-1 inline-block">
                              {period.videos.map((video) => (
                                <li key={video.id} className="truncate">
                                  <span className="font-medium">
                                    {video.title || "Không có tiêu đề"}
                                  </span>
                                  <span className="text-gray-500 ml-1">
                                    ({formatDuration(video.duration)})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Chưa có video nào được tạo để hiển thị thống kê
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPerformanceStats;
