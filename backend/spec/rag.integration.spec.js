process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const axios = require('axios');

describe('RAG Integration Tests', () => {
  let token;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await Document.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await Document.deleteMany({});

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'raguser', email: 'rag@test.com', password: 'password123' });
    token = reg.body.token;
    const user = await User.findOne({ email: 'rag@test.com' });
    userId = user._id;
  });

  // ─── Document Upload ───────────────────────────────────────────────────────

  describe('POST /api/chat/documents/upload', () => {
    it('stores a plain text file and preserves its content', async () => {
      const response = await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from('RAG test content'), {
          filename: 'notes.txt',
          contentType: 'text/plain'
        })
        .expect(200);

      expect(response.body.filename).toBe('notes.txt');
      const stored = await Document.findById(response.body._id);
      expect(stored.content).toBe('RAG test content');
    });

    it('rejects upload without authentication', async () => {
      await request(app)
        .post('/api/chat/documents/upload')
        .attach('document', Buffer.from('content'), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .expect(401);
    });

    it('rejects unsupported file types with 415', async () => {
      const response = await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from('fake image'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg'
        })
        .expect(415);

      expect(response.body.msg).toContain('Unsupported file type');
    });

    it('rejects requests with no file attached', async () => {
      await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─── Document Listing ──────────────────────────────────────────────────────

  describe('GET /api/chat/documents', () => {
    it('returns only documents belonging to the authenticated user', async () => {
      await Document.create({
        user: userId, filename: 'mine.txt',
        contentType: 'text/plain', size: 4, content: 'mine'
      });
      const other = await User.create({
        username: 'other', email: 'other@test.com', password: 'pass'
      });
      await Document.create({
        user: other._id, filename: 'theirs.txt',
        contentType: 'text/plain', size: 6, content: 'theirs'
      });

      const response = await request(app)
        .get('/api/chat/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].filename).toBe('mine.txt');
    });

    it('denies listing without authentication', async () => {
      await request(app).get('/api/chat/documents').expect(401);
    });
  });

  // ─── Document Deletion ─────────────────────────────────────────────────────

  describe('DELETE /api/chat/documents/:docId', () => {
    it('deletes a document owned by the authenticated user', async () => {
      const doc = await Document.create({
        user: userId, filename: 'delete-me.txt',
        contentType: 'text/plain', size: 3, content: 'bye'
      });

      await request(app)
        .delete(`/api/chat/documents/${doc._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(await Document.findById(doc._id)).toBeNull();
    });

    it('returns 404 when trying to delete another user\'s document', async () => {
      const other = await User.create({
        username: 'other2', email: 'other2@test.com', password: 'pass'
      });
      const doc = await Document.create({
        user: other._id, filename: 'private.txt',
        contentType: 'text/plain', size: 7, content: 'private'
      });

      await request(app)
        .delete(`/api/chat/documents/${doc._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('denies deletion without authentication', async () => {
      const doc = await Document.create({
        user: userId, filename: 'test.txt',
        contentType: 'text/plain', size: 4, content: 'test'
      });
      await request(app)
        .delete(`/api/chat/documents/${doc._id}`)
        .expect(401);
    });
  });

  // ─── RAG Context Injection ─────────────────────────────────────────────────

  describe('POST /api/chat/:chatId — document context injection', () => {
    it('includes document content in the system prompt sent to the LLM', async () => {
      const doc = await Document.create({
        user: userId, filename: 'exam.txt', contentType: 'text/plain',
        size: 40, content: 'The midterm covers chapters 1 through 5'
      });
      const chat = await Chat.create({
        user: userId, title: 'RAG Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Mocked LLM response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'What does the midterm cover?',
          models: ['ollama:llama3.2:latest'],
          documentIds: [doc._id.toString()]
        })
        .expect(200);

      expect(capturedPayload).not.toBeNull();
      const systemMsg = capturedPayload.messages[0];
      expect(systemMsg.role).toBe('system');
      expect(systemMsg.content).toContain('The midterm covers chapters 1 through 5');
    });

    it('sends no document context when no documentIds are provided', async () => {
      const chat = await Chat.create({
        user: userId, title: 'No Doc Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Hello',
          models: ['ollama:llama3.2:latest'],
          documentIds: []
        })
        .expect(200);

      expect(capturedPayload.messages[0].content).not.toContain('Use the following documents');
    });

    it('combines multiple documents into a single context block', async () => {
      const doc1 = await Document.create({
        user: userId, filename: 'a.txt', contentType: 'text/plain',
        size: 10, content: 'First document content'
      });
      const doc2 = await Document.create({
        user: userId, filename: 'b.txt', contentType: 'text/plain',
        size: 10, content: 'Second document content'
      });
      const chat = await Chat.create({
        user: userId, title: 'Multi Doc',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Summarize both documents',
          models: ['ollama:llama3.2:latest'],
          documentIds: [doc1._id.toString(), doc2._id.toString()]
        })
        .expect(200);

      const systemContent = capturedPayload.messages[0].content;
      expect(systemContent).toContain('First document content');
      expect(systemContent).toContain('Second document content');
    });

    it('does not expose another user\'s document content to the LLM', async () => {
      const other = await User.create({
        username: 'snoop', email: 'snoop@test.com', password: 'pass'
      });
      const privateDoc = await Document.create({
        user: other._id, filename: 'secret.txt', contentType: 'text/plain',
        size: 18, content: 'Top secret content'
      });
      const chat = await Chat.create({
        user: userId, title: 'Snooping Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'What are the secrets?',
          models: ['ollama:llama3.2:latest'],
          documentIds: [privateDoc._id.toString()]
        })
        .expect(200);

      expect(capturedPayload.messages[0].content).not.toContain('Top secret content');
    });

    it('saves the assistant response with the correct model label', async () => {
      const chat = await Chat.create({
        user: userId, title: 'Label Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      spyOn(axios, 'post').and.returnValue(
        Promise.resolve({ data: { message: { content: 'Labelled response' } } })
      );

      const response = await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hi', models: ['ollama:llama3.2:latest'], documentIds: [] })
        .expect(200);

      const assistantMsg = response.body.chat.messages.find(m => m.role === 'assistant');
      expect(assistantMsg.model).toBe('ollama:llama3.2:latest');
      expect(assistantMsg.content).toBe('Labelled response');
    });
  });
});
