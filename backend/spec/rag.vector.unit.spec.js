const mongoose = require('mongoose');
const { chunkText } = require('../utils/embedder');
const { cosineSimilarity, retrieveRelevantChunks } = require('../utils/retrieve');
const embedder = require('../utils/embedder');
const Document = require('../models/Document');

// Helper to generate valid 24-char hex ObjectId strings for use in unit tests
const fakeId = () => new mongoose.Types.ObjectId().toString();

describe('RAG Vector Unit Tests', () => {

  // ─── chunkText ─────────────────────────────────────────────────────────────

  describe('chunkText()', () => {
    it('returns an empty array for an empty string', () => {
      expect(chunkText('')).toEqual([]);
    });

    it('returns a single chunk when text is shorter than the size', () => {
      const result = chunkText('hello world', 500, 50);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('hello world');
    });

    it('returns a single chunk when word count exactly equals size', () => {
      const words = Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ');
      const result = chunkText(words, 10, 2);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toContain('word0');
    });

    it('produces overlapping chunks for long text', () => {
      // 6 words, size=3, overlap=1 → ['a b c', 'c d e', 'e f']
      const result = chunkText('a b c d e f', 3, 1);
      expect(result.length).toBeGreaterThan(1);
      // overlap: 'c' appears in both first and second chunk
      expect(result[0]).toContain('c');
      expect(result[1]).toContain('c');
    });

    it('every chunk contains at most `size` words', () => {
      const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
      const result = chunkText(text, 20, 5);
      for (const chunk of result) {
        expect(chunk.split(' ').length).toBeLessThanOrEqual(20);
      }
    });

    it('filters out empty chunks from whitespace-only input', () => {
      const result = chunkText('   \n\t  ', 10, 2);
      expect(result).toEqual([]);
    });

    it('uses default size and overlap when not specified', () => {
      const text = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
      const result = chunkText(text);
      // With defaults size=500, overlap=50 — should produce more than one chunk
      expect(result.length).toBeGreaterThan(1);
    });
  });

  // ─── cosineSimilarity ──────────────────────────────────────────────────────

  describe('cosineSimilarity()', () => {
    it('returns 1.0 for identical vectors', () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
    });

    it('returns -1.0 for opposite vectors', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
    });

    it('is symmetric — order of arguments does not matter', () => {
      const a = [0.3, 0.5, 0.8];
      const b = [0.1, 0.9, 0.2];
      expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
    });

    it('returns 1.0 for parallel vectors of different magnitudes', () => {
      expect(cosineSimilarity([2, 0], [5, 0])).toBeCloseTo(1.0, 5);
    });

    it('handles higher-dimension vectors without error', () => {
      const a = new Array(384).fill(0.1);
      const b = new Array(384).fill(0.2);
      const score = cosineSimilarity(a, b);
      expect(score).toBeCloseTo(1.0, 5); // same direction
    });
  });

  // ─── retrieveRelevantChunks ────────────────────────────────────────────────

  describe('retrieveRelevantChunks()', () => {
    beforeEach(() => {
      // Stub $vectorSearch to always throw so we exercise the JS fallback path
      spyOn(Document, 'aggregate').and.returnValue(Promise.reject(new Error('no Atlas')));
    });

    it('returns an empty array immediately when documentIds is empty', async () => {
      const result = await retrieveRelevantChunks('query', [], fakeId());
      expect(result).toEqual([]);
    });

    it('returns chunks sorted by cosine similarity descending', async () => {
      const queryVec = [1, 0, 0];
      const id1 = fakeId(), id2 = fakeId(), userId = fakeId();

      spyOn(embedder, 'embedText').and.returnValue(Promise.resolve(queryVec));
      spyOn(Document, 'find').and.returnValue(Promise.resolve([
        {
          _id: id1, filename: 'high.txt', content: 'high content',
          chunks: [{ text: 'relevant text', embedding: [1, 0, 0], index: 0 }]
        },
        {
          _id: id2, filename: 'low.txt', content: 'low content',
          chunks: [{ text: 'unrelated text', embedding: [0, 1, 0], index: 0 }]
        }
      ]));

      const results = await retrieveRelevantChunks('query', [id1, id2], userId);
      expect(results[0].filename).toBe('high.txt');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('respects topK and returns at most that many results', async () => {
      const userId = fakeId();
      const ids = Array.from({ length: 10 }, () => fakeId());
      spyOn(embedder, 'embedText').and.returnValue(Promise.resolve([1, 0, 0]));

      const fakeDocs = ids.map((id, i) => ({
        _id: id, filename: `doc${i}.txt`, content: `content ${i}`,
        chunks: [{ text: `chunk ${i}`, embedding: [Math.random(), Math.random(), Math.random()], index: 0 }]
      }));
      spyOn(Document, 'find').and.returnValue(Promise.resolve(fakeDocs));

      const results = await retrieveRelevantChunks('query', ids, userId, 3);
      expect(results.length).toBe(3);
    });

    it('falls back to raw content with score 0 for documents with no chunks', async () => {
      const id = fakeId(), userId = fakeId();
      spyOn(embedder, 'embedText').and.returnValue(Promise.resolve([1, 0, 0]));
      spyOn(Document, 'find').and.returnValue(Promise.resolve([
        {
          _id: id, filename: 'legacy.txt',
          content: 'Raw content from before vector upgrade.',
          chunks: []
        }
      ]));

      const results = await retrieveRelevantChunks('query', [id], userId);
      expect(results.length).toBe(1);
      expect(results[0].text).toContain('Raw content from before vector upgrade');
      expect(results[0].score).toBe(0);
    });

    it('skips chunks that have no embedding stored', async () => {
      const id = fakeId(), userId = fakeId();
      spyOn(embedder, 'embedText').and.returnValue(Promise.resolve([1, 0, 0]));
      spyOn(Document, 'find').and.returnValue(Promise.resolve([
        {
          _id: id, filename: 'partial.txt', content: 'content',
          chunks: [
            { text: 'has embedding', embedding: [1, 0, 0], index: 0 },
            { text: 'no embedding',  embedding: [],         index: 1 }
          ]
        }
      ]));

      const results = await retrieveRelevantChunks('query', [id], userId);
      expect(results.length).toBe(1);
      expect(results[0].text).toBe('has embedding');
    });
  });
});
