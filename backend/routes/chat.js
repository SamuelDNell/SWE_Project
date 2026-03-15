const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth');
const Chat = require('../models/Chat');

const router = express.Router();

// Get available models
router.get('/models', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching models from Ollama' });
  }
});

// Get all chats for a user
router.get('/', verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .select('title updatedAt messages model');
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get a specific chat
router.get('/:chatId', verifyToken, async (req, res) => {
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
});

// Create a new chat
router.post('/new', verifyToken, async (req, res) => {
  try {
    console.log('Creating new chat for user:', req.user.id);
    console.log('Request body:', req.body);

    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || 'New Chat',
      model: req.body.model || 'llama2'
    });

    console.log('Chat object before save:', chat);
    await chat.save();
    console.log('Chat saved successfully:', chat);
    res.json(chat);
  } catch (err) {
    console.error('Error creating new chat:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Send message in a chat
router.post('/:chatId', verifyToken, async (req, res) => {
  const { message, model } = req.body;

  try {
    let chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    // Add user message to chat
    chat.messages.push({
      role: 'user',
      content: message
    });

    // Get AI response
    const response = await axios.post('http://localhost:11434/api/chat', {
      model: model || chat.model,
      messages: chat.messages,
      stream: false,
    });

    // Add AI response to chat
    chat.messages.push({
      role: 'assistant',
      content: response.data.message.content
    });

    // Update chat title if it's the first message
    if (chat.messages.length === 2 && chat.title === 'New Chat') {
      chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    }

    await chat.save();

    res.json({
      message: response.data.message,
      chat: chat
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error communicating with Ollama' });
  }
});

// Update chat title
router.put('/:chatId/title', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.chatId, user: req.user.id },
      { title: req.body.title },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete a chat
router.delete('/:chatId', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    res.json({ msg: 'Chat deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Legacy chat endpoint (for backward compatibility)
router.post('/', verifyToken, async (req, res) => {
  const { messages, model = 'llama2' } = req.body;

  try {
    const response = await axios.post('http://localhost:11434/api/chat', {
      model,
      messages,
      stream: false,
    });

    res.json({ response: response.data.message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error communicating with Ollama' });
  }
});

module.exports = router;