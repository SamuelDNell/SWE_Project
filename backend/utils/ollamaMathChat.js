// Tool calling requires a model that supports the Ollama tools API.
// Recommended models: llama3.1, mistral-nemo, qwen2.5-coder
// Set via the model-selection UI already in the app.

const axios = require('axios');
const { mathToolDefinition, executeMathTool } = require('./mathTool');

const MAX_TOOL_ROUNDS = 8;

const ollamaMathChat = async (messages, systemPrompt, ollamaBaseUrl, model) => {
  const conversation = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // Tool-calling loop — handles multiple sequential tool call rounds
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await axios.post(`${ollamaBaseUrl}/api/chat`, {
      model,
      messages: conversation,
      tools: [mathToolDefinition],
      stream: false
    });

    const assistantMsg = response.data.message;

    // No tool calls requested — return the final answer
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return assistantMsg.content || '';
    }

    // Append the assistant message that contains the tool call requests
    conversation.push(assistantMsg);

    // Execute every tool call in this round and append results
    for (const toolCall of assistantMsg.tool_calls) {
      const expression = toolCall.function?.arguments?.expression;
      const result = executeMathTool(expression);
      conversation.push({
        role: 'tool',
        content: JSON.stringify(result)
      });
    }
  }

  // Safety fallback after MAX_TOOL_ROUNDS — get a plain response without tools
  const final = await axios.post(`${ollamaBaseUrl}/api/chat`, {
    model,
    messages: conversation,
    stream: false
  });

  return final.data.message?.content || '';
};

module.exports = { ollamaMathChat };
