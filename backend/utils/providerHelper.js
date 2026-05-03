const axios = require('axios');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const { retrieveRelevantChunks } = require('./retrieve');

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const anthropicClient = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
const genAI = googleApiKey ? new GoogleGenAI({ apiKey: googleApiKey }) : null;

const PROVIDER_MODELS = [
  { name: 'openai:gpt-4o', label: 'OpenAI - gpt-4o' },
  { name: 'openai:gpt-3.5-turbo', label: 'OpenAI - gpt-3.5-turbo' },
  { name: 'anthropic:claude-3-5-sonnet-20241022', label: 'Anthropic - Claude 3.5 Sonnet' },
  { name: 'anthropic:claude-3-5-haiku-20241022', label: 'Anthropic - Claude 3.5 Haiku' },
  { name: 'gemini:gemini-2.5-flash', label: 'Google - Gemini 2.5 Flash' },
  { name: 'gemini:gemini-2.0-flash-lite', label: 'Google - Gemini 2.0 Flash Lite' }
];

const OLLAMA_DEFAULT_MODELS = [
  { name: 'ollama:llama3.2:latest', label: 'Llama - llama3.2:latest' },
  { name: 'ollama:llama2:7b', label: 'Llama - llama2:7b' },
  { name: 'ollama:llama4:latest', label: 'Llama - llama4:latest' }
];

const parseModelKey = (selectedModel) => {
  if (!selectedModel) return { provider: 'ollama', model: 'llama3.2:latest' };

  if (selectedModel.includes(':')) {
    const [provider, ...rest] = selectedModel.split(':');
    const modelName = rest.join(':');
    if (provider === 'openai') return { provider: 'openai', model: modelName };
    if (provider === 'anthropic') return { provider: 'anthropic', model: modelName };
    if (provider === 'gemini') return { provider: 'gemini', model: modelName };
    if (provider === 'ollama') return { provider: 'ollama', model: modelName };
  }

  const normalized = selectedModel.toLowerCase();
  if (normalized.startsWith('gpt-')) return { provider: 'openai', model: selectedModel };
  if (normalized.startsWith('claude')) return { provider: 'anthropic', model: selectedModel };
  if (normalized.startsWith('gemini')) return { provider: 'gemini', model: selectedModel };
  if (normalized.includes('llama')) return { provider: 'ollama', model: selectedModel.replace(/^ollama:/, '') };

  return { provider: 'ollama', model: selectedModel };
};

const buildSystemPrompt = async (query, documentIds, userId) => {
  let prompt = 'You are Knightly, a smart and concise AI assistant for Rutgers University students. Answer questions directly and use uploaded documents as relevant context.';

  if (documentIds && documentIds.length > 0) {
    try {
      const chunks = await retrieveRelevantChunks(query, documentIds, userId);
      if (chunks.length > 0) {
        const context = chunks
          .map((c) => `File: ${c.filename}\n${c.text}`)
          .join('\n---\n');
        prompt += `\n\nUse the following documents as context when answering user questions:\n${context}`;
      }
    } catch (err) {
      console.error('RAG retrieval error:', err.message);
    }
  }

  prompt += '\n\nIf the user asks a question unrelated to the documents, answer using your general knowledge and do not invent file contents.';
  return prompt;
};

const getAvailableProviderModels = () => {
  return [...PROVIDER_MODELS, ...OLLAMA_DEFAULT_MODELS];
};

// Collapse consecutive same-role messages that accumulate in compare mode.
// Keeps the first of any run of assistant messages so APIs requiring
// strict user/assistant alternation don't reject the request.
const dedupeConsecutiveRoles = (messages) => {
  const result = [];
  for (const msg of messages) {
    if (result.length > 0 && result[result.length - 1].role === msg.role) {
      continue;
    }
    result.push({ role: msg.role, content: msg.content });
  }
  return result;
};

const queryProvider = async (selectedModel, messages, systemPrompt) => {
  const { provider, model } = parseModelKey(selectedModel);
  const cleanMessages = dedupeConsecutiveRoles(messages);

  if (provider === 'openai') {
    if (!openaiClient) {
      throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in .env.');
    }

    const response = await openaiClient.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...cleanMessages],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices?.[0]?.message?.content?.trim() || '';
  }

  if (provider === 'anthropic') {
    if (!anthropicClient) {
      throw new Error('Anthropic API key is not configured. Set ANTHROPIC_API_KEY in .env.');
    }

    const response = await anthropicClient.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: cleanMessages
    });

    return response.content?.[0]?.text?.trim() || '';
  }

  if (provider === 'gemini') {
    if (!genAI) {
      throw new Error('Google API key is not configured. Set GOOGLE_API_KEY in .env.');
    }

    const history = cleanMessages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    const lastMessage = cleanMessages[cleanMessages.length - 1];

    const chat = genAI.chats.create({
      model,
      config: { systemInstruction: systemPrompt },
      history
    });

    const response = await chat.sendMessage({ message: lastMessage.content });
    return response.text.trim();
  }

  if (provider === 'ollama') {
    const response = await axios.post('http://localhost:11434/api/chat', {
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...cleanMessages],
      stream: false
    });

    return response.data?.message?.content?.trim() || '';
  }

  throw new Error(`Unsupported provider: ${provider}`);
};

module.exports = {
  getAvailableProviderModels,
  queryProvider,
  parseModelKey,
  buildSystemPrompt,
  dedupeConsecutiveRoles
};
