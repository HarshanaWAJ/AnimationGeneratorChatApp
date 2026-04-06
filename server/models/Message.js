const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'voice'],
    default: 'text',
    required: true,
  },
  text: {
    type: String,
    required: true, // Original text or transcribed voice
  },
  gifUrl: {
    type: String, // Base64 data URI of the animation
  },
  audioUrl: {
    type: String, // Base64 data URI of the voice message
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Message', MessageSchema);
