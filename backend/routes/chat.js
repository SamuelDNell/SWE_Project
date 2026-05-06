const express = require('express');
const axios = require('axios');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const verifyToken = require('../middleware/auth');
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const { queryProvider, getAvailableProviderModels } = require('../utils/providerHelper');
const { addDocumentToVectorStore, retrieveRelevantContext } = require('../utils/ragHelper');
const { isMathQuery, computeMath } = require('../utils/mathHelper');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Get available models and provider-backed options
router.get('/models', async (req, res) => {
  try {
    const staticModels = getAvailableProviderModels();
    const response = await axios.get('http://localhost:11434/api/tags');
    const ollamaModels = (response.data?.models || [])
      .map((tag) => ({
        name: `ollama:${tag.name}`,
        label: `Llama - ${tag.name}`
      }));

    res.json({ models: [...staticModels, ...ollamaModels] });
  } catch (err) {
    console.error('MODEL LIST ERROR:', err.message);
    res.json({ models: getAvailableProviderModels() });
  }
});

// Get uploaded documents for the user
router.get('/documents', verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({ user: req.user.id })
      .select('filename contentType size createdAt');
    res.json(documents);
  } catch (err) {
    console.error('DOCUMENT LIST ERROR:', err);
    res.status(500).json({ msg: 'Error loading documents' });
  }
});

// Delete a document
router.delete('/documents/:docId', verifyToken, async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({
      _id: req.params.docId,
      user: req.user.id
    });
    if (!doc) return res.status(404).json({ msg: 'Document not found' });
    res.json({ msg: 'Document deleted' });
  } catch (err) {
    console.error('DOCUMENT DELETE ERROR:', err);
    res.status(500).json({ msg: 'Error deleting document' });
  }
});

// Upload a document for use in chat context
router.post('/documents/upload', verifyToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No document uploaded' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    let content = '';

    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      const parsed = await pdfParse(buffer);
      content = parsed.text;
    } else if (mimetype.startsWith('text/') || originalname.toLowerCase().endsWith('.txt')) {
      content = buffer.toString('utf8');
    } else {
      return res.status(415).json({ msg: 'Unsupported file type. Upload PDF or text files.' });
    }

    const document = new Document({
      user: req.user.id,
      filename: originalname,
      contentType: mimetype,
      size,
      content
    });
    await document.save();

// Add document to vector store for semantic retrieval
await addDocumentToVectorStore(document._id, content);

res.json(document);
  } catch (err) {
    console.error('DOCUMENT UPLOAD ERROR:', err);
    res.status(500).json({ msg: 'Failed to upload document', error: err.message });
  }
});

// Get all chats for a user
router.get('/', verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('title createdAt updatedAt messages model models documents');
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
    res.status(500).json({ msg: 'Search failed', error: err.message });
  }
});

// Get a specific chat
router.get('/:chatId', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    }).populate('documents', 'filename contentType size createdAt');

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
    const selectedModel = req.body.model || 'ollama:llama3.2:latest';
    const selectedModels = Array.isArray(req.body.models) && req.body.models.length
      ? req.body.models
      : [selectedModel];
    const documentIds = Array.isArray(req.body.documentIds) ? req.body.documentIds : [];

    const chat = new Chat({
      user: req.user.id,
      title: req.body.title || 'New Chat',
      model: selectedModel,
      models: selectedModels,
      documents: documentIds
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
  const { message, models, documentIds } = req.body;

  try {
    let chat = await Chat.findOne({
      _id: req.params.chatId,
      user: req.user.id
    });

    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    chat.messages.push({ role: 'user', content: message });
    // Math tool handling
if (isMathQuery(message)) {
  const mathResult = computeMath(message);

  if (mathResult.success) {
    chat.messages.push({
      role: 'assistant',
      content: `Math Tool Result: ${mathResult.result}`,
      model: 'math-tool'
    });

    await chat.save();

    return res.json({
      responses: [
        {
          model: 'math-tool',
          content: `Math Tool Result: ${mathResult.result}`
        }
      ],
      chat
    });
  }
}

    const selectedModels = Array.isArray(models) && models.length
      ? models
      : (chat.models && chat.models.length ? chat.models : [chat.model || 'ollama:llama3.2:latest']);

    const requestedDocumentIds = Array.isArray(documentIds) ? documentIds : [];
    const activeDocumentIds = requestedDocumentIds.length ? requestedDocumentIds : chat.documents || [];
    const documents = activeDocumentIds.length
      ? await Document.find({ _id: { $in: activeDocumentIds }, user: req.user.id })
      : [];

    const documentContext = activeDocumentIds.length
  ? await retrieveRelevantContext(activeDocumentIds, message)
  : '';

    const results = await Promise.allSettled(
      selectedModels.map((selectedModel) =>
        queryProvider(selectedModel, chat.messages, documentContext)
      )
    );

    const successfulResponses = [];
    const failedModels = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        chat.messages.push({ role: 'assistant', content: result.value, model: selectedModels[index] });
        successfulResponses.push({ model: selectedModels[index], content: result.value });
      } else {
        const apiError = result.reason?.response?.data?.error?.message
          || result.reason?.response?.data?.message
          || result.reason?.message
          || 'Unknown error';
        console.error(`Model ${selectedModels[index]} failed:`, result.reason?.response?.data || result.reason?.message);
        failedModels.push({ model: selectedModels[index], error: apiError });
      }
    });

    if (successfulResponses.length === 0) {
      return res.status(500).json({
        msg: `All models failed: ${failedModels.map((f) => `${f.model}: ${f.error}`).join('; ')}`
      });
    }

    chat.models = selectedModels;
    if (requestedDocumentIds.length) {
      chat.documents = requestedDocumentIds;
    }

    if (chat.messages.filter((m) => m.role === 'user').length === 1 && chat.title === 'New Chat') {
      chat.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    }

    chat.updatedAt = new Date();
    await chat.save();

    res.json({
      responses: successfulResponses,
      failedModels: failedModels.length ? failedModels : undefined,
      chat
    });
  } catch (err) {
    console.error('CHAT ROUTE ERROR:', err);
    res.status(500).json({ msg: `Chat request failed: ${err.message}` });
  }
});

// Keep only one model output for the latest user turn
router.put('/:chatId/select-output', verifyToken, async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ msg: 'Model is required' });
    }

    const chat = await Chat.findOne({ _id: req.params.chatId, user: req.user.id });
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
    const hasModelResponse = assistantResponses.some((message) => message.role === 'assistant' && message.model === model);

    if (!hasModelResponse) {
      return res.status(400).json({ msg: 'Selected model response not found' });
    }

    const filteredMessages = [
      ...previousMessages,
      ...assistantResponses.filter((message) => message.role !== 'assistant' || message.model === model)
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
    const chat = await Chat.findOneAndDelete({ _id: req.params.chatId, user: req.user.id });
    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }
    res.json({ msg: 'Chat deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
