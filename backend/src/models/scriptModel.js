const mongoose = require("mongoose");

const scriptSchema = new mongoose.Schema({
  workId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Work",
  },
  scriptText: String,
  createdAt: Date,
});

module.exports = mongoose.model("Script", scriptSchema);
