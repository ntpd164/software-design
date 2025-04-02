const mongoose = require("mongoose");

const VoiceSchema = new mongoose.Schema({
  scriptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Script",
    required: true,
  },
  audioUrl: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: "vi",
  },
  style: {
    type: String,
    default: "formal",
  },
  settings: {
    type: Object,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Voice", VoiceSchema);
