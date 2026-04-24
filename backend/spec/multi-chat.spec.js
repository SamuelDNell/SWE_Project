process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const axios = require('axios');

describe('Multi-LLM Chat API', () => {
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

    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    token = registerResponse.body.token;
    const user = await User.findOne({ email: 'test@example.com' });
    userId = user._id;
  });

  describe('POST /api/chat/:chatId/multi', () => {
    it('should get responses from multiple models', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'New Chat',
        model: 'llama3.2:latest',
        messages: []
      });

      spyOn(axios, 'post').and.callFake((url, data) => {
        return Promise.resolve({
          data: {
            message: {
              content: `Response from ${data.model}`
            }
          }
        });
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}/multi`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Compare these models',
          models: ['model1', 'model2', 'model3']
        })
        .expect(200);

      expect(response.body.options).toBeDefined();
      expect(response.body.options.length).toBe(3);
      expect(response.body.options[0].content).toContain('model1');
      expect(response.body.options[1].content).toContain('model2');
      expect(response.body.options[2].content).toContain('model3');
      
      const updatedChat = await Chat.findById(chat._id);
      expect(updatedChat.messages.length).toBe(1);
      expect(updatedChat.messages[0].role).toBe('user');
    });
  });

  describe('POST /api/chat/:chatId/choose', () => {
    it('should save the selected response', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Multi Chat',
        model: 'llama3.2:latest',
        messages: [{ role: 'user', content: 'Compare these models' }]
      });

      const response = await request(app)
        .post(`/api/chat/${chat._id}/choose`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'I like this response best',
          model: 'phi3.5:latest'
        })
        .expect(200);

      expect(response.body.messages.length).toBe(2);
      expect(response.body.messages[1].role).toBe('assistant');
      expect(response.body.messages[1].content).toBe('I like this response best');
      expect(response.body.messages[1].model).toBe('phi3.5:latest');
      expect(response.body.model).toBe('phi3.5:latest');
    });
  });
});