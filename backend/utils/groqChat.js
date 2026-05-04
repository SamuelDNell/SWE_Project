const axios = require('axios');
const { mathToolDefinition, executeMathTool } = require('./mathTool');
const { toolDefinition: weatherToolDefinition, executeWeatherTool } = require('./weatherTool');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const groqChat = async (messages, systemPrompt, model = 'llama-3.3-70b-versatile') => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured. Set GROQ_API_KEY in .env.');
  }

  const tools = [mathToolDefinition, weatherToolDefinition];
  const conversation = [{ role: 'system', content: systemPrompt }, ...messages];

  const post = (msgs) => axios.post(GROQ_API_URL, {
    model,
    messages: msgs,
    tools,
    tool_choice: 'auto'
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  let response = await post(conversation);
  let choice = response.data.choices[0];

  while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    conversation.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      const name = toolCall.function?.name;
      const args = JSON.parse(toolCall.function?.arguments || '{}');
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
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    response = await post(conversation);
    choice = response.data.choices[0];
  }

  return choice.message.content?.trim() || '';
};

module.exports = { groqChat };
