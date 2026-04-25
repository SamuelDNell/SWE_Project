process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const Chat = require('../models/Chat');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');

describe("Multi-LLM Feature", () => {
  let token;
  let userId;
  let chatId;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/chatbot_test');

    const user = new User({
      username: "multiuser",
      email: "multi@test.com",
      password: "password123"
    });

    await user.save();
    userId = user._id;

    token = jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET);

    const chat = new Chat({
      user: userId,
      title: "Test Multi Chat"
    });

    await chat.save();
    chatId = chat._id;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await mongoose.connection.close();
  });

  it("should send one prompt and receive responses from multiple models", async () => {
    spyOn(axios, 'post').and.returnValues(
      Promise.resolve({
        data: { message: { content: "Response from phi" } }
      }),
      Promise.resolve({
        data: { message: { content: "Response from llama" } }
      })
    );

    const res = await request(app)
      .post(`/api/chat/${chatId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Hello" });

    expect(res.statusCode).toBe(200);
    expect(res.body.messages.length).toBe(2);
    expect(res.body.messages[0].model).toBe("phi");
    expect(res.body.messages[1].model).toBe("llama3.2:latest");
    expect(res.body.messages[0].content).toBeDefined();
    expect(res.body.messages[1].content).toBeDefined();
  });
});