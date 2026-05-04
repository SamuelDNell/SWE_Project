const axios = require('axios');
const { mathToolDefinition, executeMathTool } = require('./mathTool');
const { toolDefinition: weatherToolDefinition, executeWeatherTool } = require('./weatherTool');

const MAX_TOOL_ROUNDS = 8;

const ollamaChat = async (messages, systemPrompt, ollamaBaseUrl, model) => {
  const conversation = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await axios.post(`${ollamaBaseUrl}/api/chat`, {
      model,
      messages: conversation,
      tools: [mathToolDefinition, weatherToolDefinition],
      stream: false
    });

    const assistantMsg = response.data.message;

    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return assistantMsg.content || '';
    }

    conversation.push(assistantMsg);

    for (const toolCall of assistantMsg.tool_calls) {
      const name = toolCall.function?.name;
      const args = toolCall.function?.arguments || {};
      let result;

      if (name === 'solve_math') {
        result = executeMathTool(args.expression);
      } else if (name === 'get_weather') {
        result = await executeWeatherTool(args.city, args.days);
      } else {
        result = { error: `Unknown tool: ${name}` };
      }

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

module.exports = { ollamaChat };
