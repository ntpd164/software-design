const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  scriptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Script',
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Video', videoSchema);
