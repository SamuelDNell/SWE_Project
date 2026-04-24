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
    console.log('Creating new chat for user:', req.user.id);
    console.log('Request body:', req.body);

    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || 'New Chat',
      model: req.body.model || 'llama3.2:latest'
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
    const selectedModel = 'phi';
    console.log("USING MODEL:", selectedModel);


  const systemPrompt = {
  role: 'system',
  content: `You are Knightly, a helpful AI assistant for Rutgers University students.

- Answer the user's question directly.
- Keep responses short and clear (2–4 sentences).
- Stay on topic.
- Do not create stories unless asked.
- Do not repeat instructions.
- Do not mention rules or guidelines.
- Do not change the user's name.`
};

  
    // Get AI response
    // const response = await axios.post('http://localhost:11434/api/chat', {
    //   model: selectedModel,
    //   messages: [systemPrompt, ...chat.messages], /// messages: chat.messages,
    //   stream: false,
    // });
    // Model 1
  // Run 2 models in parallel
const [response1, response2] = await Promise.all([
  axios.post('http://localhost:11434/api/chat', {
    model: 'phi',
    messages: [systemPrompt, ...chat.messages],
    stream: false,
  }),
  axios.post('http://localhost:11434/api/chat', {
    model: 'tinyllama',
    messages: [systemPrompt, ...chat.messages],
    stream: false,
  })
]);

// Run 3rd model after (series)
const response3 = await axios.post('http://localhost:11434/api/chat', {
  model: 'qwen:0.5b',
  messages: [systemPrompt, ...chat.messages],
  stream: false,
});

    // Add AI response to chat
    chat.messages.push({
      role: 'assistant',
      content: `**Model 1:**
${response1.data.message.content}

  
**Model 2:**
${response2.data.message.content}

  
**Model 3:**
${response3.data.message.content}`
    });

    // Update chat title if it's the first message
    if (chat.messages.length === 2 && chat.title === 'New Chat') {
      chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    }

    // console.log("Before save, updatedAt =", chat.updatedAt); // Log the updatedAt field before saving
    // await chat.save();
    // console.log("After save"); // Log after saving to confirm the save operation completed

    chat.updatedAt = new Date(); //using updatedAt here seems to fix the issue where "ollama crash" error pops up after the first message
    console.log("Before save, updatedAt =", chat.updatedAt);
    await chat.save();
    console.log("After save");

    res.json({
  model1: response1.data.message,
  model2: response2.data.message,
  chat: chat
});
  } catch (err) {//updated error handling to log more details and return more info in the response
    // console.error(err);
    // res.status(500).json({ msg: 'Error communicating with Ollama' });

    console.error("CHAT ROUTE ERROR:");
    console.error(err);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("Ollama response:", err.response?.data);

    res.status(500).json({
      msg: 'Chat request failed',
      error: err.message,
      details: err.response?.data || null
    });
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

router.post('/test', async (req, res) => {
  const message = req.body.message;

  const systemPrompt = {
    role: 'system',
    content: 'Answer briefly.'
  };

  try {
    const [response1, response2] = await Promise.all([
      axios.post('http://localhost:11434/api/chat', {
        model: 'phi',
        messages: [systemPrompt, { role: 'user', content: message }],
        stream: false,
      }),
      axios.post('http://localhost:11434/api/chat', {
        model: 'tinyllama',
        messages: [systemPrompt, { role: 'user', content: message }],
        stream: false,
      })
    ]);

    const response3 = await axios.post('http://localhost:11434/api/chat', {
      model: 'qwen:0.5b',
      messages: [systemPrompt, { role: 'user', content: message }],
      stream: false,
    });

    res.json({
      model1: response1.data.message.content,
      model2: response2.data.message.content,
      model3: response3.data.message.content
    });

  } catch (err) {
    res.status(500).json({ error: 'Test failed' });
  }
});

module.exports = router;