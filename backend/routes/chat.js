const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth');
const Chat = require('../models/Chat');

const router = express.Router();

const MULTI_MODELS = ['llama3.2:latest', 'qwen3:latest', 'gemma3:4b'];
const SYSTEM_PROMPT = {
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

function buildConversationMessages(chatMessages) {
  return chatMessages
    .filter(message => (message.role === 'user' || message.role === 'assistant') && message.content)
    .map(message => ({
      role: message.role,
      content: message.content
    }));
}

function formatModelFailure(error) {
  return error?.response?.data?.error || error?.message || 'Model request failed';
}

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
      .select('title updatedAt messages model modelSelected');
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Search chats by title or message content
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
        modelSelected: chat.modelSelected,
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
    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || 'New Chat',
      model: req.body.model || MULTI_MODELS[0],
      modelSelected: false
    });

    await chat.save();
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
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (!trimmedMessage) {
      return res.status(400).json({ msg: 'Message is required' });
    }

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    chat.messages.push({
      role: 'user',
      content: trimmedMessage
    });

    const conversationMessages = [SYSTEM_PROMPT, ...buildConversationMessages(chat.messages)];

    if (!chat.modelSelected) {
      const responses = await Promise.allSettled(
        MULTI_MODELS.map(currentModel =>
          axios.post('http://localhost:11434/api/chat', {
            model: currentModel,
            messages: conversationMessages,
            stream: false,
          })
        )
      );

      const formattedResponses = responses.map((result, index) => ({
        model: MULTI_MODELS[index],
        content: result.status === 'fulfilled' ? result.value.data.message.content : null,
        success: result.status === 'fulfilled',
        error: result.status === 'fulfilled' ? null : formatModelFailure(result.reason)
      }));

      chat.messages.push({
        role: 'assistant_multi',
        responses: formattedResponses
      });

      chat.updatedAt = new Date();
      await chat.save();

      return res.json({
        mode: 'multi',
        responses: formattedResponses,
        hasSuccessfulResponses: formattedResponses.some(response => response.success),
        chat
      });
    }

    const selectedModel = chat.model || model || MULTI_MODELS[0];
    const response = await axios.post('http://localhost:11434/api/chat', {
      model: selectedModel,
      messages: conversationMessages,
      stream: false,
    });

    chat.messages.push({
      role: 'assistant',
      content: response.data.message.content,
      model: selectedModel
    });

    chat.model = selectedModel;
    chat.updatedAt = new Date();
    await chat.save();

    return res.json({
      mode: 'single',
      message: {
        ...response.data.message,
        model: selectedModel
      },
      chat
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Chat request failed' });
  }
});

// Select one response from the most recent multi-model turn
router.post('/:chatId/select', verifyToken, async (req, res) => {
  const { model } = req.body;

  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    const multiMessage = [...chat.messages].reverse().find(message => message.role === 'assistant_multi');
    if (!multiMessage) {
      return res.status(400).json({ msg: 'No multi-model response available to select' });
    }

    const selectedResponse = multiMessage.responses.find(
      response => response.model === model && response.success && response.content
    );
    if (!selectedResponse) {
      return res.status(400).json({ msg: 'Selected response is not available' });
    }

    if (multiMessage.selectedModel === model) {
      return res.json({
        chat,
        selectedResponse
      });
    }

    multiMessage.selectedModel = model;
    multiMessage.selectedAt = new Date();

    chat.messages.push({
      role: 'assistant',
      content: selectedResponse.content,
      model
    });

    chat.model = model;
    chat.modelSelected = true;
    chat.updatedAt = new Date();
    chat.markModified('messages');
    await chat.save();

    res.json({
      chat,
      selectedResponse
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error selecting response' });
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
  const { messages, model = MULTI_MODELS[0] } = req.body;

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
