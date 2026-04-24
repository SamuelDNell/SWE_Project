process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const axios = require('axios');

describe('Chat API', () => {
  let token;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

    token = registerResponse.body.token;
    const user = await User.findOne({ email: 'test@example.com' });
    userId = user._id;
  });

  describe('POST /api/chat/new', () => {
    it('creates a new chat in compare mode with the default model placeholder', async () => {
      const response = await request(app)
        .post('/api/chat/new')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Chat' })
        .expect(200);

      expect(response.body.title).toBe('New Chat');
      expect(response.body.model).toBe('llama3.2:latest');
      expect(response.body.modelSelected).toBe(false);
    });
  });

  describe('GET /api/chat', () => {
    it('returns only chats for the logged-in user sorted by most recent activity', async () => {
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashed_password'
      });

      await Chat.create([
        {
          user: userId,
          title: 'Older chat',
          updatedAt: new Date('2026-04-20T12:00:00Z')
        },
        {
          user: userId,
          title: 'Newest chat',
          updatedAt: new Date('2026-04-22T12:00:00Z')
        },
        {
          user: otherUser._id,
          title: 'Someone else',
          updatedAt: new Date('2026-04-23T12:00:00Z')
        }
      ]);

      const response = await request(app)
        .get('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body[0].title).toBe('Newest chat');
      expect(response.body[1].title).toBe('Older chat');
    });
  });

  describe('GET /api/chat/:chatId', () => {
    it('does not allow a user to access another user chat', async () => {
      const otherUser = await User.create({
        username: 'privateuser',
        email: 'private@example.com',
        password: 'hashed_password'
      });

      const otherChat = await Chat.create({
        user: otherUser._id,
        title: 'Private chat'
      });

      const response = await request(app)
        .get(`/api/chat/${otherChat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.msg).toBe('Chat not found');
    });
  });

  describe('POST /api/chat/:chatId', () => {
    it('fans one prompt out to three models and stores the grouped responses', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Compare models',
        messages: []
      });

      spyOn(axios, 'post').and.callFake((url, body) => {
        const contentByModel = {
          'llama3.2:latest': 'Llama answer',
          'qwen3:latest': 'Qwen answer',
          'gemma3:4b': 'Gemma answer'
        };

        return Promise.resolve({
          data: {
            message: {
              content: contentByModel[body.model]
            }
          }
        });
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'What classes should I take next semester?' })
        .expect(200);

      expect(response.body.mode).toBe('multi');
      expect(response.body.responses.length).toBe(3);
      expect(response.body.responses.every((item) => item.success)).toBe(true);
      expect(response.body.chat.messages.length).toBe(2);
      expect(response.body.chat.messages[1].role).toBe('assistant_multi');
      expect(response.body.chat.messages[1].responses[0].model).toBe('llama3.2:latest');
    });

    it('returns successful responses even when one model fails', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Partial failure',
        messages: []
      });

      spyOn(axios, 'post').and.callFake((url, body) => {
        if (body.model === 'qwen3:latest') {
          return Promise.reject(new Error('Model offline'));
        }

        return Promise.resolve({
          data: {
            message: {
              content: `${body.model} response`
            }
          }
        });
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Give me study tips' })
        .expect(200);

      const failedResponse = response.body.responses.find((item) => item.model === 'qwen3:latest');
      expect(response.body.hasSuccessfulResponses).toBe(true);
      expect(failedResponse.success).toBe(false);
      expect(failedResponse.error).toContain('Model offline');
    });

    it('uses the selected model only after a response has been chosen', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Continue with model',
        model: 'gemma3:4b',
        modelSelected: true,
        messages: [
          { role: 'user', content: 'Help me plan finals week' },
          { role: 'assistant', content: 'Sure, here is a plan', model: 'gemma3:4b' }
        ]
      });

      spyOn(axios, 'post').and.callFake((url, body) => {
        expect(body.model).toBe('gemma3:4b');
        expect(body.messages.length).toBe(4);

        return Promise.resolve({
          data: {
            message: {
              content: 'Follow-up answer from Gemma'
            }
          }
        });
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Now make it shorter' })
        .expect(200);

      expect(response.body.mode).toBe('single');
      expect(response.body.chat.messages[3].content).toBe('Follow-up answer from Gemma');
      expect(response.body.chat.messages[3].model).toBe('gemma3:4b');
    });
  });

  describe('POST /api/chat/:chatId/select', () => {
    it('marks a response as selected and saves it as the continuation point', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Pick a winner',
        messages: [
          { role: 'user', content: 'Explain recursion simply' },
          {
            role: 'assistant_multi',
            responses: [
              { model: 'llama3.2:latest', content: 'Llama version', success: true },
              { model: 'qwen3:latest', content: 'Qwen version', success: true },
              { model: 'gemma3:4b', content: null, success: false, error: 'Timed out' }
            ]
          }
        ]
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}/select`)
        .set('Authorization', `Bearer ${token}`)
        .send({ model: 'qwen3:latest' })
        .expect(200);

      expect(response.body.chat.model).toBe('qwen3:latest');
      expect(response.body.chat.modelSelected).toBe(true);
      expect(response.body.chat.messages[1].selectedModel).toBe('qwen3:latest');
      expect(response.body.chat.messages[2].role).toBe('assistant');
      expect(response.body.chat.messages[2].content).toBe('Qwen version');
      expect(response.body.chat.messages[2].model).toBe('qwen3:latest');
    });
  });
});
