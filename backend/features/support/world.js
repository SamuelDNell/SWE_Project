process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const { setWorldConstructor, BeforeAll, AfterAll, Before, After } = require('@cucumber/cucumber');
const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
const app = require('../../index');
const User = require('../../models/User');
const Chat = require('../../models/Chat');
const Document = require('../../models/Document');
const axios = require('axios');

BeforeAll(async function () {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(process.env.MONGODB_URI);
});

AfterAll(async function () {
  await User.deleteMany({});
  await Chat.deleteMany({});
  await Document.deleteMany({});
  await mongoose.connection.close();
});

Before(async function () {
  await User.deleteMany({});
  await Chat.deleteMany({});
  await Document.deleteMany({});

  process.env.GROQ_API_KEY = 'test_groq_key';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'cucumberuser', email: 'cucumber@test.com', password: 'password123' });

  this.token = res.body.token;
  const user = await User.findOne({ email: 'cucumber@test.com' });
  this.userId = user._id;
  this.lastResponse = null;
  this.uploadedDocIds = [];
  this.activeChatId = null;
  this.capturedLLMPayload = null;
  this.capturedGroqPayload = null;
  this.toolResult = null;
  this.axiosStub = null;
  this.axiosGetStub = null;
});

After(async function () {
  if (this.axiosStub) {
    this.axiosStub.restore();
    this.axiosStub = null;
  }
  if (this.axiosGetStub) {
    this.axiosGetStub.restore();
    this.axiosGetStub = null;
  }
  delete process.env.GROQ_API_KEY;
});

class RagWorld {
  constructor() {
    this.app = app;
    this.request = request;
    this.sinon = sinon;
    this.User = User;
    this.Chat = Chat;
    this.Document = Document;
    this.axios = axios;
    this.token = null;
    this.userId = null;
    this.lastResponse = null;
    this.uploadedDocIds = [];
    this.activeChatId = null;
    this.capturedLLMPayload = null;
    this.capturedGroqPayload = null;
    this.toolResult = null;
    this.axiosStub = null;
    this.axiosGetStub = null;
  }
}

setWorldConstructor(RagWorld);
