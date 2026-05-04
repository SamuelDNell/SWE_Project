const { ollamaChat } = require('./ollamaChat');
const { groqChat } = require('./groqChat');

const OLLAMA_BASE_URL = 'http://localhost:11434';

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
    if (provider === 'groq') return { provider: 'groq', model: modelName };
    if (provider === 'ollama') return { provider: 'ollama', model: modelName };
  }

  const normalized = selectedModel.toLowerCase();
  if (normalized.includes('llama') && !selectedModel.startsWith('ollama:')) return { provider: 'groq', model: selectedModel };
  if (normalized.includes('llama')) return { provider: 'ollama', model: selectedModel.replace(/^ollama:/, '') };

  return { provider: 'ollama', model: selectedModel };
};

const buildSystemPrompt = (documentContext, provider = null) => {
  let prompt = 'You are Knightly, a smart and concise AI assistant for Rutgers University students. Answer questions directly and use uploaded documents as relevant context.';
  if (documentContext) {
    prompt += `\n\nUse the following documents as context when answering user questions:\n${documentContext}`;
  }
  if (provider === 'ollama' || provider === 'groq') {
    prompt += '\n\nYou have access to a get_weather tool for real-time weather data. ' +
      'Use it whenever the user asks about weather, temperature, forecast, or conditions in any location. ' +
      'Present weather results clearly with current conditions and forecast if requested. ' +
      'Always specify the units: °F for temperature, mph for wind speed.\n' +
      'You also have access to a solve_math tool for exact calculations. ' +
      'Use it for any numeric computation, derivative, integral, or statistical calculation. ' +
      'After getting tool results, format math using LaTeX:\n' +
      '- Inline math: $expression$\n' +
      '- Block math: $$expression$$';
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

  if (provider === 'groq') {
    return await groqChat(cleanMessages, systemPrompt, model);
  }

  if (provider === 'ollama') {
    return await ollamaChat(cleanMessages, systemPrompt, OLLAMA_BASE_URL, model);
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
