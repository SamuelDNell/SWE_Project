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
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret';

    console.log('TEST DB URI:', process.env.MONGODB_URI);
    

    if (mongoose.connection.readyState === 0) { //connecting to test database if not already connected
      await mongoose.connect(process.env.MONGODB_URI); //every test seems to be wiping real local data?
    }
    console.log('Connected DB name:', mongoose.connection.name);
  });

  afterAll(async () => {
    await User.deleteMany({}); //clearing users
    await Chat.deleteMany({}); //clearing chats
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});

    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    token = registerResponse.body.token;

    const user = await User.findOne({ email: 'test@example.com' });
    userId = user._id;
  });

  describe('POST /api/chat/new', () => {
    it('should create a new chat with default llama3.2 model', async () => {
      const response = await request(app)
        .post('/api/chat/new')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Chat' })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.title).toBe('New Chat');
      expect(response.body.model).toBe('llama3.2:latest');
      expect(response.body.user).toBeDefined();
    });

    it('should deny creating a chat without a token', async () => {
      const response = await request(app)
        .post('/api/chat/new')
        .send({ title: 'Unauthorized Chat' })
        .expect(401);

      expect(response.body.msg).toBe('No token, authorization denied');
    });
  });

  describe('GET /api/chat/search/:query', () => {
    it('should return matching chats for the logged-in user', async () => {
      await Chat.create([
        {
          user: userId,
          title: 'software engineering notes',
          model: 'llama3.2:latest',
          messages: [
            { role: 'user', content: 'what is software engineering?' },
            { role: 'assistant', content: 'Software engineering is...' }
          ]
        },
        {
          user: userId,
          title: 'campus life',
          model: 'llama3.2:latest',
          messages: [
            { role: 'user', content: 'how is Rutgers?' },
            { role: 'assistant', content: 'Rutgers is...' }
          ]
        }
      ]);

      const response = await request(app)
        .get('/api/chat/search/software')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toContain('software');
      expect(response.body[0].score).toBeDefined();
      expect(response.body[0].snippet).toBeDefined();
    });

    it('should not return chats belonging to another user', async () => {
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'dummy_password'
      });

      await Chat.create([
        {
          user: userId,
          title: 'software chat',
          model: 'llama3.2:latest',
          messages: [{ role: 'user', content: 'software question' }]
        },
        {
          user: otherUser._id,
          title: 'software from other user',
          model: 'llama3.2:latest',
          messages: [{ role: 'user', content: 'software secret' }]
        }
      ]);

      const response = await request(app)
        .get('/api/chat/search/software')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('software chat');
    });

    it('should deny search without a token', async () => {
      const response = await request(app)
        .get('/api/chat/search/software')
        .expect(401);

      expect(response.body.msg).toBe('No token, authorization denied');
    });
  });

  describe('POST /api/chat/:chatId', () => {
    it('should send a message and save assistant response', async () => {
      const chat = await Chat.create({
        user: userId,
        title: 'Test Chat',
        model: 'llama3.2:latest',
        messages: []
      });

      spyOn(axios, 'post').and.returnValue(
        Promise.resolve({
          data: {
            message: {
              content: 'This is a mocked LLM response.'
            }
          }
        })
      );

      const response = await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Hello',
          model: 'llama3.2:latest'
        })
        .expect(200);

      expect(response.body.chat).toBeDefined();
      expect(response.body.chat.messages.length).toBe(2);
      expect(response.body.chat.messages[0].content).toBe('Hello');
      expect(response.body.chat.messages[1].content).toContain('Model 1:');
expect(response.body.chat.messages[1].content).toContain('Model 2:');
expect(response.body.chat.messages[1].content).toContain('Model 3:');
    });
  });
});