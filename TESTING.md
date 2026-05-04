# Testing — Knightly AI Assistant

This document covers the full test suite for the Knightly AI Assistant, including Jasmine unit tests, Jasmine integration tests, Cucumber acceptance tests, and Puppeteer end-to-end tests.

---

## Running the Tests

### Jasmine (unit + integration)

```bash
cd backend
npm test
```

### Cucumber (acceptance)

```bash
cd backend
npm run test:acceptance
```

### ESLint

```bash
cd backend
npm run lint
```

### Puppeteer (end-to-end demo)

Requires the frontend and backend to be running first.

```bash
cd UI-Testing
node multi_llm_puppeteer_test.js
```

---

## Backend Test Files (`backend/spec/`)

| File | Type | What it covers |
|------|------|----------------|
| `auth.spec.js` | Integration | User registration, login, and token auth endpoints |
| `chat.spec.js` | Integration | Chat creation, message sending, and chat management endpoints |
| `rag.unit.spec.js` | Unit | `buildSystemPrompt`, `dedupeConsecutiveRoles`, `parseModelKey` |
| `rag.vector.unit.spec.js` | Unit | `chunkText`, `cosineSimilarity`, `retrieveRelevantChunks` |
| `rag.integration.spec.js` | Integration | Document upload, RAG context injection, document deletion |
| `rag.acceptance.spec.js` | Acceptance | End-to-end RAG pipeline with real embeddings |
| `math.unit.spec.js` | Unit | `executeMathTool`, `mathToolDefinition`, `buildSystemPrompt` per provider |
| `math.integration.spec.js` | Integration | `ollamaMathChat` tool loop, chat route with math tool, Groq system prompts |
| `weather.unit.spec.js` | Unit | `executeWeatherTool`, weather `toolDefinition`, `buildSystemPrompt` weather instructions |
| `weather.integration.spec.js` | Integration | `ollamaChat` weather routing, `groqChat` tool loop, chat route with weather tool |

---

## Cucumber Acceptance Tests (`backend/features/`)

### `document_rag.feature` — 6 scenarios

Tests the document upload and RAG pipeline from a user perspective:

- Upload a plain text document successfully
- Uploaded document content is injected into the LLM context
- Multiple documents are combined into context
- Delete a document removes it from the list
- Unsupported file type is rejected with status 415
- Another user's document is not accessible

### `math_tooling.feature` — 6 scenarios

Tests math tool calling behavior:

- Math question via Ollama returns the correct answer after a tool call
- Math question via Groq returns the correct answer after a tool call
- Ollama system prompt includes math tool instructions
- Groq system prompt includes math tool instructions
- Ollama request includes both the math and weather tools
- The solve_math tool handles an invalid expression without crashing

### `weather_tooling.feature` — 6 scenarios

Tests weather tool calling behavior:

- Weather question via Ollama returns current conditions for the city
- Weather question via Groq returns current conditions for the city
- Ollama system prompt includes weather tool instructions
- Groq system prompt includes weather tool instructions
- Groq request includes both the weather and math tools
- An unknown city is handled gracefully without crashing

---

## Frontend Test Files (`frontend/spec/`)

| File | What it covers |
|------|----------------|
| `ui.spec.js` | Landing page, login form, registration form, chat interface elements, localStorage, API availability |
| `Home.spec.jsx` | Home page component rendering and state |
| `ChatHistory.spec.jsx` | Chat History page rendering and search |

---

## Test Architecture

### Unit Tests

Unit tests are self-contained — they import only the function under test, call it with controlled inputs, and assert on the return value. No database, no HTTP server, and no external API calls. They run instantly and serve as the first line of defense for regressions in routing, prompt construction, math evaluation, and vector similarity logic.

### Integration Tests

Integration tests use `supertest` to make real HTTP requests against the Express app and a dedicated test MongoDB database (`chatbot_test`). `axios.post` and `axios.get` are intercepted using Jasmine's `spyOn` so that Ollama and Groq calls never leave the process. The stubs are URL-aware: calls to port `11434` are treated as Ollama and calls to `api.groq.com` as Groq. Each test uses `beforeEach` to clear the database and register a fresh user, ensuring full isolation between tests.

### Cucumber Acceptance Tests

Cucumber tests are written in Gherkin and run against the live Express app. A shared world class (`features/support/world.js`) holds references to the app, sinon, supertest, mongoose models, and state fields like `capturedLLMPayload` and `capturedGroqPayload`. Sinon stubs intercept both `axios.post` (for LLM calls) and `axios.get` (for Open-Meteo weather API calls). Each scenario runs against a clean database state set up by the `Before` hook.

### Puppeteer End-to-End Tests

The Puppeteer test (`UI-Testing/multi_llm_puppeteer_test.js`) drives a real browser against the running application and records a video of the session. It covers four scenarios:

1. **Compare mode** — selects Groq Llama 3.3 70B and llama3.2:latest, asks a question, and verifies both model responses appear with a "Use this answer" button
2. **Document upload** — uploads `sample_document.txt` with llama3.2:latest and asks a specific question about the document content
3. **Weather tool** — asks about the current weather in Tokyo using llama3.2:latest
4. **Math tool** — asks for the derivative of 6x³ + 9x + 2 using llama3.2:latest

The recording is saved as `demo_recording.webm` and automatically converted to `demo_recording.mp4` via ffmpeg after the session ends.

---

## Test Dependencies

### Backend

| Package | Purpose |
|---------|---------|
| `jasmine` | Test runner and assertion library |
| `supertest` | HTTP endpoint testing |
| `sinon` | Stubs and spies for axios interception |
| `@cucumber/cucumber` | BDD acceptance test runner |

### Frontend

| Package | Purpose |
|---------|---------|
| `jasmine` | Test runner |
| `jsdom` | DOM environment simulation |

### UI Testing

| Package | Purpose |
|---------|---------|
| `puppeteer` | Headless browser automation and screen recording |
| `ffmpeg` | Convert WebM recording to MP4 (system dependency) |
