const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  scriptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Script",
    required: true,
  },
  prompt: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  metadata: {
    type: Object,
    default: {
      model: "@cf/black-forest-labs/flux-1-schnell",
      num_steps: 8,
    },
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

// Update timestamps on save
ImageSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Image", ImageSchema);
