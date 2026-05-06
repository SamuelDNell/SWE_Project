const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OllamaEmbeddings } = require("@langchain/community/embeddings/ollama");

const vectorStores = new Map();

const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434"
});

async function addDocumentToVectorStore(documentId, content) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100
  });

  const docs = await splitter.createDocuments([content]);

  const vectorStore = await MemoryVectorStore.fromDocuments(
    docs,
    embeddings
  );

  vectorStores.set(documentId.toString(), vectorStore);

  console.log(`Stored ${docs.length} chunks for document ${documentId}`);
}

async function retrieveRelevantContext(documentIds, query) {
  let combinedContext = "";

  for (const docId of documentIds) {
    const vectorStore = vectorStores.get(docId.toString());

    if (!vectorStore) continue;

    const results = await vectorStore.similaritySearch(query, 4);

    combinedContext += results
      .map((doc) => doc.pageContent)
      .join("\n\n");
  }

  return combinedContext;
}

module.exports = {
  addDocumentToVectorStore,
  retrieveRelevantContext
};