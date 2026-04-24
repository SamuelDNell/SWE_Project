const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'assistant_multi']
  },
  content: {
    type: String
  },
  model: {
    type: String
  },
  responses: [
    {
      model: {
        type: String
      },
      content: {
        type: String,
        default: null
      },
      success: {
        type: Boolean,
        default: false
      },
      error: {
        type: String,
        default: null
      }
    }
  ],
  selectedModel: {
    type: String,
    default: null
  },
  selectedAt: {
    type: Date
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ChatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  messages: [MessageSchema],
  model: {
    type: String,
    default: "llama3.2:latest"
  },
  modelSelected: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', ChatSchema);
