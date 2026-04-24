const { chatHandlers } = require('../routes/chat');
const Chat = require('../models/Chat');
const axios = require('axios');

describe('Chat Handlers Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 'user123' },
      params: {},
      body: {}
    };
    res = {
      json: jasmine.createSpy('json'),
      status: jasmine.createSpy('status').and.callFake(() => res)
    };
  });

  describe('multiLLM', () => {
    it('should return multiple LLM options', async () => {
      req.params.chatId = 'chat123';
      req.body.message = 'Test message';
      req.body.models = ['m1', 'm2'];

      const mockChat = {
        _id: 'chat123',
        messages: [],
        title: 'New Chat',
        save: jasmine.createSpy('save').and.resolveTo(this)
      };

      spyOn(Chat, 'findOne').and.resolveTo(mockChat);
      spyOn(axios, 'post').and.callFake((url, data) => {
        return Promise.resolve({
          data: {
            message: { content: `Response from ${data.model}` }
          }
        });
      });

      await chatHandlers.multiLLM(req, res);

      expect(Chat.findOne).toHaveBeenCalled();
      expect(mockChat.messages.length).toBe(1);
      expect(mockChat.messages[0].content).toBe('Test message');
      expect(res.json).toHaveBeenCalled();
      
      const jsonResponse = res.json.calls.mostRecent().args[0];
      expect(jsonResponse.options.length).toBe(2);
      expect(jsonResponse.options[0].model).toBe('m1');
      expect(jsonResponse.options[1].model).toBe('m2');
    });
  });

  describe('chooseResponse', () => {
    it('should save the selected assistant response', async () => {
      req.params.chatId = 'chat123';
      req.body.content = 'Selected content';
      req.body.model = 'mistral:latest';

      const mockChat = {
        _id: 'chat123',
        messages: [{ role: 'user', content: 'hello' }],
        save: jasmine.createSpy('save').and.resolveTo(this)
      };

      spyOn(Chat, 'findOne').and.resolveTo(mockChat);

      await chatHandlers.chooseResponse(req, res);

      expect(mockChat.messages.length).toBe(2);
      expect(mockChat.messages[1].role).toBe('assistant');
      expect(mockChat.messages[1].content).toBe('Selected content');
      expect(mockChat.messages[1].model).toBe('mistral:latest');
      expect(mockChat.model).toBe('mistral:latest');
      expect(res.json).toHaveBeenCalledWith(mockChat);
    });
  });
});