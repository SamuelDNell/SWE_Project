const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth');

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

// Chat endpoint
router.post('/', verifyToken, async (req, res) => {
  const { messages, model = 'llama2' } = req.body; // messages array for conversation

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