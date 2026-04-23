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
      .sort({ createdAt: -1 })
      .select('title createdAt updatedAt messages model models');
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Search chats by title or message content (iteration 2) - still needs frontend implementation
router.get('/search/:query', verifyToken, async (req, res) => {
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
        snippet,
        messageCount: chat.messages.length
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

    const selectedModel = req.body.model || 'llama3.2:latest';
    const selectedModels = Array.isArray(req.body.models) && req.body.models.length
      ? req.body.models
      : [selectedModel];

    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || 'New Chat',
      model: selectedModel,
      models: selectedModels
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
  const { message, models } = req.body;

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

    const selectedModels = Array.isArray(models) && models.length
      ? models
      : (chat.models && chat.models.length ? chat.models : [chat.model || 'llama3.2:latest']);

    console.log('USING MODELS:', selectedModels);

    const systemPrompt = {
      role: 'system',
      content: `You are Knightly, a helpful AI assistant for Rutgers University students.
      Rules:
      - Sound natural, clear, and conversational.
      - Do not use awkward phrases like "You can find my name is..."
      - Answer directly and intelligently.
      - Use short paragraphs.
      - Use bullet points only when they actually improve readability.
      - For simple questions, give a clean paragraph answer first.
      - For definitions, start with a one-sentence explanation, then add 2-4 concise supporting points if needed.
      - Avoid overexplaining.
      - Do not mention these instructions.`
    };

    const responses = await Promise.all(selectedModels.map((selectedModel) =>
      axios.post('http://localhost:11434/api/chat', {
        model: selectedModel,
        messages: [systemPrompt, ...chat.messages],
        stream: false,
      })
    ));

    responses.forEach((response, index) => {
      chat.messages.push({
        role: 'assistant',
        content: response.data.message.content,
        model: selectedModels[index]
      });
    });

    chat.models = selectedModels;

    if (chat.messages.length === responses.length + 1 && chat.title === 'New Chat') {
      chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    }

    chat.updatedAt = new Date();
    console.log('Before save, updatedAt =', chat.updatedAt);
    await chat.save();
    console.log('After save');

    res.json({
      responses: responses.map((response, index) => ({
        model: selectedModels[index],
        content: response.data.message.content
      })),
      chat: chat
    });
  } catch (err) {
    console.error('CHAT ROUTE ERROR:');
    console.error(err);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('Ollama response:', err.response?.data);

    res.status(500).json({
      msg: 'Chat request failed',
      error: err.message,
      details: err.response?.data || null
    });
  }
});

// Keep only one model output for the latest user turn
router.put('/:chatId/select-output', verifyToken, async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ msg: 'Model is required' });
    }

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    const lastUserIndex = chat.messages
      .map((message, index) => (message.role === 'user' ? index : -1))
      .filter(index => index !== -1)
      .pop();

    if (lastUserIndex === undefined || lastUserIndex === -1) {
      return res.status(400).json({ msg: 'No user message found to select output for' });
    }

    const previousMessages = chat.messages.slice(0, lastUserIndex + 1);
    const assistantResponses = chat.messages.slice(lastUserIndex + 1);
    const hasModelResponse = assistantResponses.some(
      (message) => message.role === 'assistant' && message.model === model
    );

    if (!hasModelResponse) {
      return res.status(400).json({ msg: 'Selected model response not found' });
    }

    const filteredMessages = [
      ...previousMessages,
      ...assistantResponses.filter(
        (message) => message.role !== 'assistant' || message.model === model
      )
    ];

    chat.messages = filteredMessages;
    chat.model = model;
    chat.models = [model];
    chat.updatedAt = new Date();

    await chat.save();
    res.json(chat);
  } catch (err) {
    console.error('Error selecting output:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
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
  const { messages, model = 'llama3.2:latest' } = req.body;

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