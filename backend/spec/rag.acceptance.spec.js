process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

// Embedding model load + inference takes several seconds — raise the timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Document = require('../models/Document');
const axios = require('axios');
const { embedText } = require('../utils/embedder');
const { retrieveRelevantChunks } = require('../utils/retrieve');

describe('RAG Acceptance Tests', () => {
  let token;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(process.env.MONGODB_URI);
    // Warm up the embedding model once so individual specs don't hit the cold-load penalty
    await embedText('warmup');
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
      .send({ username: 'ragacceptance', email: 'rag_acceptance@test.com', password: 'password123' });
    token = reg.body.token;
    const user = await User.findOne({ email: 'rag_acceptance@test.com' });
    userId = user._id;
  });

  // ─── Upload produces real vector embeddings ────────────────────────────────

  describe('Document upload creates vector embeddings', () => {
    it('stores chunks with 384-dimension embeddings after a text upload', async () => {
      const content = 'Neural networks are computational models inspired by the human brain. They process data through interconnected layers. Backpropagation adjusts weights to minimize error during training.';

      const response = await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from(content), { filename: 'ml.txt', contentType: 'text/plain' })
        .expect(200);

      const doc = await Document.findById(response.body._id);
      expect(doc.chunks.length).toBeGreaterThan(0);
      expect(doc.chunks[0].embedding.length).toBe(384);
      expect(doc.chunks[0].text).toBeTruthy();
      expect(doc.chunks[0].index).toBe(0);
    });

    it('keeps the raw content field alongside chunks for backward compatibility', async () => {
      const content = 'Backward compatibility test content.';

      const response = await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from(content), { filename: 'test.txt', contentType: 'text/plain' })
        .expect(200);

      const doc = await Document.findById(response.body._id);
      expect(doc.content).toBe(content);
      expect(doc.chunks.length).toBeGreaterThan(0);
    });
  });

  // ─── Semantic retrieval finds the right chunks ─────────────────────────────

  describe('Semantic retrieval returns relevant chunks over irrelevant ones', () => {
    it('ranks the topically matching chunk higher than an unrelated chunk', async () => {
      const mlContent = 'Neural networks learn by adjusting weights through backpropagation. Gradient descent minimizes the loss function. Deep learning stacks multiple hidden layers to extract complex features from raw input data.';
      const historyContent = 'Julius Caesar crossed the Rubicon in 49 BC, triggering a Roman civil war. The Roman Senate conspired against him and assassinated Caesar on the Ides of March. His death ended the Roman Republic and began the Imperial era.';

      const mlDoc = await Document.create({
        user: userId, filename: 'ml.txt', contentType: 'text/plain',
        size: mlContent.length, content: mlContent,
        chunks: [{ text: mlContent, embedding: await embedText(mlContent), index: 0 }]
      });

      const historyDoc = await Document.create({
        user: userId, filename: 'history.txt', contentType: 'text/plain',
        size: historyContent.length, content: historyContent,
        chunks: [{ text: historyContent, embedding: await embedText(historyContent), index: 0 }]
      });

      const results = await retrieveRelevantChunks(
        'How do neural networks learn from data?',
        [mlDoc._id.toString(), historyDoc._id.toString()],
        userId.toString(),
        2
      );

      expect(results.length).toBe(2);
      expect(results[0].filename).toBe('ml.txt');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('returns an empty array when no document IDs are provided', async () => {
      const results = await retrieveRelevantChunks('any query', [], userId.toString());
      expect(results).toEqual([]);
    });

    it('respects the topK limit', async () => {
      const texts = [
        'Alpha content about cooking pasta and Italian cuisine recipes.',
        'Beta content about cycling routes and mountain bike trails.',
        'Gamma content about JavaScript promises and async await patterns.',
        'Delta content about gardening tomatoes and watering schedules.'
      ];

      const ids = await Promise.all(texts.map(async (text, i) => {
        const doc = await Document.create({
          user: userId, filename: `doc${i}.txt`, contentType: 'text/plain',
          size: text.length, content: text,
          chunks: [{ text, embedding: await embedText(text), index: 0 }]
        });
        return doc._id.toString();
      }));

      const results = await retrieveRelevantChunks('async programming in JavaScript', ids, userId.toString(), 2);
      expect(results.length).toBe(2);
    });
  });

  // ─── Full pipeline: upload → chat → relevant context reaches the LLM ───────

  describe('Full RAG pipeline delivers relevant content to the LLM', () => {
    it('injects the uploaded document text into the LLM system prompt via vector retrieval', async () => {
      const content = 'The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration involving the electron transport chain and oxidative phosphorylation.';

      const uploadRes = await request(app)
        .post('/api/chat/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('document', Buffer.from(content), { filename: 'biology.txt', contentType: 'text/plain' })
        .expect(200);

      const chat = await Chat.create({
        user: userId, title: 'Biology Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Mocked response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'What does the mitochondria do?',
          models: ['ollama:llama3.2:latest'],
          documentIds: [uploadRes.body._id]
        })
        .expect(200);

      expect(capturedPayload).not.toBeNull();
      const systemContent = capturedPayload.messages[0].content;
      expect(systemContent).toContain('mitochondria');
      expect(systemContent).toContain('File: biology.txt');
    });

    it('prioritizes the document most relevant to the query when multiple are selected', async () => {
      const cookingContent = 'To make pasta, boil salted water and cook spaghetti for eight minutes until al dente. Drain and toss with marinara sauce and fresh basil leaves.';
      const algorithmContent = 'A binary search tree stores nodes in sorted order. Insertion, search, and deletion run in O(log n) average time. Self-balancing trees like AVL prevent worst-case O(n) degradation.';

      const cookingDoc = await Document.create({
        user: userId, filename: 'cooking.txt', contentType: 'text/plain',
        size: cookingContent.length, content: cookingContent,
        chunks: [{ text: cookingContent, embedding: await embedText(cookingContent), index: 0 }]
      });

      const algoDoc = await Document.create({
        user: userId, filename: 'algorithms.txt', contentType: 'text/plain',
        size: algorithmContent.length, content: algorithmContent,
        chunks: [{ text: algorithmContent, embedding: await embedText(algorithmContent), index: 0 }]
      });

      const chat = await Chat.create({
        user: userId, title: 'Algo Chat',
        model: 'ollama:llama3.2:latest', messages: []
      });

      let capturedPayload = null;
      spyOn(axios, 'post').and.callFake((url, data) => {
        if (url.includes('11434')) capturedPayload = data;
        return Promise.resolve({ data: { message: { content: 'Mocked response' } } });
      });

      await request(app)
        .post(`/api/chat/${chat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'What is the time complexity of binary search tree operations?',
          models: ['ollama:llama3.2:latest'],
          documentIds: [cookingDoc._id.toString(), algoDoc._id.toString()]
        })
        .expect(200);

      const systemContent = capturedPayload.messages[0].content;
      expect(systemContent).toContain('binary search tree');
      expect(systemContent).toContain('File: algorithms.txt');
    });

    it('falls back to raw content for documents uploaded before the vector upgrade', async () => {
      const legacyDoc = await Document.create({
        user: userId, filename: 'legacy.txt', contentType: 'text/plain',
        size: 50, content: 'Legacy document content uploaded before vector support.'
        // no chunks field — simulates a pre-upgrade document
      });

      const chat = await Chat.create({
        user: userId, title: 'Legacy Chat',
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
          message: 'What is in this document?',
          models: ['ollama:llama3.2:latest'],
          documentIds: [legacyDoc._id.toString()]
        })
        .expect(200);

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.messages[0].content).toContain('Legacy document content');
    });
  });
});
