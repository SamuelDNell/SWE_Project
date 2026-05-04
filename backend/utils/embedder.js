let pipelineInstance = null;

const getEmbedder = async () => {
  if (!pipelineInstance) {
    const { pipeline } = await import('@xenova/transformers');
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return pipelineInstance;
};

const embedText = async (text) => {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

// Word-based sliding window — returns string[]
const chunkText = (text, size = 500, overlap = 50) => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(' '));
    i += size - overlap;
    if (i + overlap >= words.length && i < words.length) {
      chunks.push(words.slice(i).join(' '));
      break;
    }
  }
  return chunks.filter((c) => c.trim().length > 0);
};

module.exports = { embedText, chunkText };
