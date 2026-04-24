# Testing Guide

This iteration adds coverage for the multi-model chat flow, authenticated chat history, and response selection workflow.

## What is covered

### Backend
- Authenticated chat creation in compare mode
- Authenticated chat history retrieval sorted by `updatedAt`
- User isolation for chat detail access
- One prompt fanout to three models
- Partial model failure handling with successful responses still returned
- Selecting one model response and continuing the conversation with that model only

### Frontend
- Shared chat UI helper logic for:
  - sorting chat history
  - compare-mode vs selected-model labels
  - header/composer text changes after selection
  - timestamp formatting fallback

### Browser automation
- Login
- Start a new chat
- Submit one prompt
- Verify the three response cards render
- Select one model response
- Send a follow-up prompt in single-model mode
- Open chat history

## Run the tests

### Backend specs
Requires MongoDB running locally at `mongodb://localhost:27017/chatbot_test`.

```bash
cd backend
npm test
```

### Frontend specs
These are Jasmine unit tests for chat helper logic and browser-storage basics.

```bash
cd frontend
npm test
```

### Cucumber UI tests
Runs the existing feature suite under `UI-Testing/features`.

```bash
cd UI-Testing
npm test
```

### Puppeteer demo for this iteration
This is the fastest way to visually verify the new multi-model workflow.

Prerequisites:
- frontend running on `http://localhost:5173`
- backend running on `http://localhost:3000`
- Ollama running locally with `llama3.2:latest`, `qwen3:latest`, and `gemma3:4b`
- a login account available

Optional environment variables:
- `FRONTEND_URL`
- `DEMO_EMAIL`
- `DEMO_PASSWORD`

```bash
cd UI-Testing
npm run demo
```

## Notes

- The backend specs stub the Ollama chat calls with `axios` spies, so they do not require the models to be installed.
- The Puppeteer demo is intended for end-to-end verification and does require the full stack to be running.
- Chat history and chat detail endpoints are authenticated and scoped to the logged-in user only.
