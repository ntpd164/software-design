const Video = require("../models/videoModel");

/**
 * Get the week number for a date
 * @param {Date} date - The date to get the week number for
 * @returns {string} Week number in YYYY-WW format
 */
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Set to nearest Thursday
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
};

/**
 * Get the month for a date
 * @param {Date} date - The date to get the month for
 * @returns {string} Month in YYYY-MM format
 */
const getMonth = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
};

/**
 * Get the day for a date
 * @param {Date} date - The date to get the day for
 * @returns {string} Day in YYYY-MM-DD format
 */
const getDay = (date) => {
  return new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD format
};

/**
 * Format a period label for display
 * @param {string} period - The period string (day, week, or month)
 * @param {string} groupType - The type of grouping (day, week, month)
 * @returns {string} Formatted period label
 */
const formatPeriodLabel = (period, groupType) => {
  if (groupType === "day") {
    return period; // Already in YYYY-MM-DD format
  } else if (groupType === "week") {
    const [year, week] = period.split("-W");
    return `Tuần ${week}, ${year}`;
  } else if (groupType === "month") {
    const [year, month] = period.split("-");
    const monthNames = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];
    return `${monthNames[parseInt(month) - 1]}, ${year}`;
  }
  return period;
};

/**
 * Calculate video creation performance statistics
 * Groups videos by day, week, or month
 * @param {Object} options - Options for statistics
 * @param {string} options.groupBy - How to group the data (day, week, month)
 * @returns {Promise<Object>} Statistics data
 */
const getVideoPerformanceStats = async (options = {}) => {
  try {
    const { groupBy = "day" } = options;

    // Get all videos sorted by creation date
    const videos = await Video.find().sort({ createdAt: 1 }).lean();

    if (!videos || videos.length === 0) {
      return {
        success: true,
        stats: {
          periodStats: [],
          totalVideos: 0,
          averageDuration: 0,
          oldestVideo: null,
          newestVideo: null,
          groupBy,
        },
      };
    }

    // Group videos by the selected period
    const periodStats = {};
    let totalDuration = 0;

    videos.forEach((video) => {
      const date = new Date(video.createdAt);

      // Get period key based on groupBy parameter
      let periodKey;
      if (groupBy === "week") {
        periodKey = getWeekNumber(date);
      } else if (groupBy === "month") {
        periodKey = getMonth(date);
      } else {
        // Default to day
        periodKey = getDay(date);
      }

      if (!periodStats[periodKey]) {
        periodStats[periodKey] = {
          period: periodKey,
          displayLabel: formatPeriodLabel(periodKey, groupBy),
          count: 0,
          totalDuration: 0,
          videos: [],
        };
      }

      // Parse duration to number if it's stored as string
      const duration =
        typeof video.duration === "string"
          ? parseInt(video.duration, 10)
          : video.duration;

      periodStats[periodKey].count += 1;
      periodStats[periodKey].totalDuration += duration;
      periodStats[periodKey].videos.push({
        id: video._id,
        title: video.title,
        duration: duration,
        createdAt: video.createdAt,
      });

      totalDuration += duration;
    });

    // Convert to array and sort by period
    const periodStatsArray = Object.values(periodStats).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    // Calculate average duration
    const averageDuration =
      videos.length > 0 ? totalDuration / videos.length : 0;

    return {
      success: true,
      stats: {
        periodStats: periodStatsArray,
        totalVideos: videos.length,
        averageDuration: Math.round(averageDuration),
        oldestVideo: videos[0],
        newestVideo: videos[videos.length - 1],
        groupBy,
      },
    };
  } catch (error) {
    console.error("Error calculating video statistics:", error);
    throw error;
  }
};

module.exports = {
  getVideoPerformanceStats,
};
