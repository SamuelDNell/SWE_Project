const axios = require('axios');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
const { ollamaMathChat } = require('./ollamaMathChat');

const OLLAMA_BASE_URL = 'http://localhost:11434';

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const anthropicClient = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const PROVIDER_MODELS = [
  { name: 'groq:llama-3.3-70b-versatile', label: 'Groq - Llama 3.3 70B' },
  { name: 'groq:llama-3.1-8b-instant', label: 'Groq - Llama 3.1 8B' }
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
    if (provider === 'groq') return { provider: 'groq', model: modelName };
    if (provider === 'ollama') return { provider: 'ollama', model: modelName };
  }

  const normalized = selectedModel.toLowerCase();
  if (normalized.startsWith('gpt-')) return { provider: 'openai', model: selectedModel };
  if (normalized.startsWith('claude')) return { provider: 'anthropic', model: selectedModel };
  if (normalized.includes('llama') && !selectedModel.startsWith('ollama:')) return { provider: 'groq', model: selectedModel };
  if (normalized.includes('llama')) return { provider: 'ollama', model: selectedModel.replace(/^ollama:/, '') };

  return { provider: 'ollama', model: selectedModel };
};

const buildSystemPrompt = (documentContext, provider = null) => {
  let prompt = 'You are Knightly, a smart and concise AI assistant for Rutgers University students. Answer questions directly and use uploaded documents as relevant context.';
  if (documentContext) {
    prompt += `\n\nUse the following documents as context when answering user questions:\n${documentContext}`;
  }
  if (provider === 'ollama') {
    prompt += '\n\nYou have access to a solve_math tool that computes math exactly. ' +
      'ALWAYS use it for any numeric computation, derivative, integral, or statistical calculation. ' +
      'After getting the tool result, explain the solution step by step using LaTeX formatting:\n' +
      '- Inline math: $expression$\n' +
      '- Block math: $$expression$$\n' +
      'Never compute math mentally — always call the tool first, then explain.';
  }
  if (provider === 'groq') {
    prompt += '\n\nWhen answering math questions, always format your response using LaTeX:\n' +
      '- Inline math: $expression$\n' +
      '- Block math: $$expression$$\n' +
      'Show your working step by step.';
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

const queryProvider = async (selectedModel, messages, documentContext) => {
  const { provider, model } = parseModelKey(selectedModel);
  const systemPrompt = buildSystemPrompt(documentContext, provider);
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

  if (provider === 'groq') {
    if (!groqClient) {
      throw new Error('Groq API key is not configured. Set GROQ_API_KEY in .env.');
    }

    const response = await groqClient.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...cleanMessages],
      temperature: 0.7,
      max_tokens: 1024
    });

    return response.choices?.[0]?.message?.content?.trim() || '';
  }

  if (provider === 'ollama') {
    return await ollamaMathChat(cleanMessages, systemPrompt, OLLAMA_BASE_URL, model);
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
