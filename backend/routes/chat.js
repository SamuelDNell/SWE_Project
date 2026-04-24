const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth');
const Chat = require('../models/Chat');


const router = express.Router();

const chatHandlers = {
  // Get available models
  getModels: async (req, res) => {
    try {
      const response = await axios.get('http://localhost:11434/api/tags');
      res.json(response.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Error fetching models from Ollama' });
    }
  },

  // Get all chats for a user
  getChats: async (req, res) => {
    try {
      const chats = await Chat.find({ user: req.user.id })
        .sort({ updatedAt: -1 })
        .select('title updatedAt messages model');
      res.json(chats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  },

  // Search chats
  searchChats: async (req, res) => {
    try {
      const rawQuery = req.params.query || '';
      const query = rawQuery.trim().toLowerCase();

      if (!query) {
        return res.status(400).json({ msg: 'Search query is required' });
      }

      const chats = await Chat.find({
        user: req.user.id,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { 'messages.content': { $regex: query, $options: 'i' } }
        ]
      });

      const rankedChats = chats.map(chat => {
        let score = 0;
        let snippet = '';

        const title = (chat.title || '').toLowerCase();

        if (title === query) score += 100;
        else if (title.startsWith(query)) score += 70;
        else if (title.includes(query)) score += 50;

        let messageMatchCount = 0;

        for (const msg of chat.messages) {
          const content = (msg.content || '').toLowerCase();

          if (content === query) {
            score += 30;
            messageMatchCount++;
            if (!snippet) snippet = msg.content;
          } else if (content.includes(query)) {
            score += 12;
            messageMatchCount++;

            if (!snippet) {
              const index = content.indexOf(query);
              const start = Math.max(0, index - 40);
              const end = Math.min(msg.content.length, index + query.length + 80);

              snippet = msg.content.substring(start, end).trim();
              if (start > 0) snippet = '...' + snippet;
              if (end < msg.content.length) snippet += '...';
            }
          }
        }

        score += messageMatchCount * 5;

        return {
          _id: chat._id,
          title: chat.title,
          updatedAt: chat.updatedAt,
          createdAt: chat.createdAt,
          model: chat.model,
          score,
          snippet
        };
      });

      rankedChats.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      res.json(rankedChats);
    } catch (err) {
      console.error('SEARCH ERROR:', err);
      res.status(500).json({
        msg: 'Search failed',
        error: err.message
      });
    }
  },

  // Get a specific chat
  getChatById: async (req, res) => {
    try {
      const chat = await Chat.findOne({
        _id: req.params.chatId,
        user: req.user.id
      });

      if (!chat) {
        return res.status(404).json({ msg: 'Chat not found' });
      }

      res.json(chat);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  },

  // Create a new chat
  createNewChat: async (req, res) => {
    try {
      const chat = new Chat({
        user: req.user.id,
        title: req.body.title || 'New Chat',
        model: req.body.model || 'llama3.2:latest'
      });
      await chat.save();
      res.json(chat);
    } catch (err) {
      console.error('Error creating new chat:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  },

  // Send message in a chat
  sendMessage: async (req, res) => {
    const { message, model } = req.body;

    try {
      let chat = await Chat.findOne({
        _id: req.params.chatId,
        user: req.user.id
      });

      if (!chat) {
        return res.status(404).json({ msg: 'Chat not found' });
      }

      chat.messages.push({ role: 'user', content: message });
      const selectedModel = model || chat.model || 'llama3.2:latest';

      const systemPrompt = {
        role: 'system',
        content: `You are Knightly, a helpful AI assistant for Rutgers University students. Respond naturally and concisely.`
      };

      const response = await axios.post('http://localhost:11434/api/chat', {
        model: selectedModel,
        messages: [systemPrompt, ...chat.messages],
        stream: false,
      }, {
        timeout: 120000
      });

      chat.messages.push({
        role: 'assistant',
        content: response.data.message.content || response.data.message.thinking || "No response content.",
        model: selectedModel
      });

      if (model) chat.model = model;
      if (chat.messages.length === 2 && chat.title === 'New Chat') {
        chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }

      chat.updatedAt = new Date();
      await chat.save();

      res.json({ message: response.data.message, chat: chat });
    } catch (err) {
      console.error("CHAT ROUTE ERROR:", err.message);
      if (err.code === 'ECONNABORTED') {
        return res.status(504).json({ msg: 'Request timed out with Ollama', error: err.message });
      }
      res.status(500).json({ msg: 'Chat request failed', error: err.message });
    }
  },

  // Multi-LLM request
  multiLLM: async (req, res) => {
    const { message, models } = req.body;
    const targetModels = models || ['llama3.2:latest', 'phi3.5:latest', 'mistral:latest'];

    try {
      let chat = await Chat.findOne({
        _id: req.params.chatId,
        user: req.user.id
      });

      if (!chat) {
        return res.status(404).json({ msg: 'Chat not found' });
      }

      const lastMsg = chat.messages[chat.messages.length - 1];
      if (!lastMsg || lastMsg.content !== message || lastMsg.role !== 'user') {
        chat.messages.push({ role: 'user', content: message });
        if (chat.messages.length === 1 && chat.title === 'New Chat') {
          chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
        }
        chat.updatedAt = new Date();
        await chat.save();
      }

      const systemPrompt = {
        role: 'system',
        content: `You are Knightly, a helpful AI assistant for Rutgers University students. Respond naturally and concisely.`
      };

      const responsePromises = targetModels.map(async (modelName) => {
        try {
          const response = await axios.post('http://localhost:11434/api/chat', {
            model: modelName,
            messages: [systemPrompt, ...chat.messages],
            stream: false,
          }, { timeout: 120000 });
          
          return {
            model: modelName,
            content: response.data.message.content || response.data.message.thinking || "No response content.",
            success: true
          };
        } catch (err) {
          console.error(`Error with model ${modelName}:`, err.message);
          return {
            model: modelName,
            content: `Error: ${err.code === 'ECONNABORTED' ? 'Request timed out' : 'Failed to get response'} from ${modelName}`,
            success: false
          };
        }
      });

      const options = await Promise.all(responsePromises);
      res.json({ chat: chat, options: options });
    } catch (err) {
      console.error("MULTI-CHAT ERROR:", err);
      res.status(500).json({ msg: 'Multi-chat request failed', error: err.message });
    }
  },

  // Choose response
  chooseResponse: async (req, res) => {
    const { content, model } = req.body;

    try {
      let chat = await Chat.findOne({
        _id: req.params.chatId,
        user: req.user.id
      });

      if (!chat) {
        return res.status(404).json({ msg: 'Chat not found' });
      }

      chat.messages.push({ role: 'assistant', content: content, model: model });
      chat.model = model;
      chat.updatedAt = new Date();
      await chat.save();

      res.json(chat);
    } catch (err) {
      console.error("CHOOSE ERROR:", err);
      res.status(500).json({ msg: 'Selection failed', error: err.message });
    }
  },

  // Update title
  updateTitle: async (req, res) => {
    try {
      const chat = await Chat.findOneAndUpdate(
        { _id: req.params.chatId, user: req.user.id },
        { title: req.body.title },
        { new: true }
      );
      if (!chat) return res.status(404).json({ msg: 'Chat not found' });
      res.json(chat);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  },

  // Delete chat
  deleteChat: async (req, res) => {
    try {
      const chat = await Chat.findOneAndDelete({ _id: req.params.chatId, user: req.user.id });
      if (!chat) return res.status(404).json({ msg: 'Chat not found' });
      res.json({ msg: 'Chat deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  }
};

// Define routes using the handlers
router.get('/models', chatHandlers.getModels);
router.get('/', verifyToken, chatHandlers.getChats);
router.get('/search/:query', verifyToken, chatHandlers.searchChats);
router.get('/:chatId', verifyToken, chatHandlers.getChatById);
router.post('/new', verifyToken, chatHandlers.createNewChat);
router.post('/:chatId', verifyToken, chatHandlers.sendMessage);
router.post('/:chatId/multi', verifyToken, chatHandlers.multiLLM);
router.post('/:chatId/choose', verifyToken, chatHandlers.chooseResponse);
router.put('/:chatId/title', verifyToken, chatHandlers.updateTitle);
router.delete('/:chatId', verifyToken, chatHandlers.deleteChat);

module.exports = { router, chatHandlers };