const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  scriptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Script",
    required: true,
  },
  videoUrl: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: "Untitled Video",
  },
  duration: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Video", videoSchema);
