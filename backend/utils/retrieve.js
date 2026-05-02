const mongoose = require('mongoose');
const Document = require('../models/Document');
const { embedText } = require('./embedder');

const cosineSimilarity = (a, b) => {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
};

const retrieveRelevantChunks = async (query, documentIds, userId, topK = 5) => {
  if (!documentIds || documentIds.length === 0) return [];

  const queryEmbedding = await embedText(query);
  const docObjectIds = documentIds.map((id) => new mongoose.Types.ObjectId(id));
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Try Atlas $vectorSearch first (must be the first stage; use filter for pre-filtering)
  try {
    const results = await Document.aggregate([
      {
        $vectorSearch: {
          index: 'chunks_vector_index',
          path: 'chunks.embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: topK,
          filter: { _id: { $in: docObjectIds }, user: userObjectId }
        }
      },
      {
        $project: {
          filename: 1,
          chunks: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    if (results.length > 0) return results.map((r) => ({
      filename: r.filename,
      text: r.chunks?.[0]?.text || '',
      score: r.score
    }));
  } catch (_) {
    // $vectorSearch not available (local MongoDB) — fall through to JS similarity
  }

  // JS fallback: fetch documents and compute cosine similarity in memory
  const docs = await Document.find({ _id: { $in: docObjectIds }, user: userObjectId });
  const allChunks = [];

  for (const doc of docs) {
    if (doc.chunks && doc.chunks.length > 0) {
      for (const chunk of doc.chunks) {
        if (chunk.embedding && chunk.embedding.length > 0) {
          allChunks.push({
            filename: doc.filename,
            text: chunk.text,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
          });
        }
      }
    } else if (doc.content) {
      // Backward compat: document uploaded before vector support
      allChunks.push({
        filename: doc.filename,
        text: doc.content.slice(0, 2800),
        score: 0
      });
    }
  }

  return allChunks.sort((a, b) => b.score - a.score).slice(0, topK);
};

module.exports = { retrieveRelevantChunks };
