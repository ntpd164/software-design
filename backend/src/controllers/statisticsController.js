const statisticsService = require("../services/statisticsService");

/**
 * Get video performance statistics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getVideoPerformanceStats = async (req, res) => {
  try {
    const { groupBy } = req.query;

    // Validate groupBy parameter
    const validGroupings = ["day", "week", "month"];
    const validGroupBy = validGroupings.includes(groupBy) ? groupBy : "day";

    const result = await statisticsService.getVideoPerformanceStats({
      groupBy: validGroupBy,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting video statistics:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve video statistics",
    });
  }
};
