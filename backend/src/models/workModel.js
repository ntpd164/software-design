const mongoose = require("mongoose");

const workSchema = new mongoose.Schema({
  pageid: Number,
  title: String,
  introduction: String,
  metadata: Object,
  createdAt: Date,
});

module.exports = mongoose.model("Work", workSchema);
