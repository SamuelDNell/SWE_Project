# Knightly AI Assistant

A full-stack AI chat application for Rutgers University students. Supports multiple LLM providers (Groq cloud models and local Ollama models), document upload with vector-based RAG, math tool calling via mathjs, and real-time weather tool calling via Open-Meteo.

---

## Prerequisites

- Node.js v18 or higher
- MongoDB (local or Atlas)
- Ollama — [ollama.com](https://ollama.com)
- Git

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/SamuelDNell/SWE_Project.git
cd SWE_Project
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment variables

Create `backend/.env` with the following:

```
MONGODB_URI=mongodb://localhost:27017/chatbot
JWT_SECRET=your_jwt_secret_here
PORT=3000
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your_groq_api_key_here
```

- **MONGODB_URI** — local MongoDB or your MongoDB Atlas connection string
- **JWT_SECRET** — any long random string for signing auth tokens
- **GROQ_API_KEY** — free key from [console.groq.com](https://console.groq.com), no credit card required

### 4. Start MongoDB

```bash
mongod
```

If using Atlas, ensure your cluster is active and the connection string in `.env` is correct.

### 5. Download local Ollama models

The app supports the following local models. Pull whichever you want to use:

```bash
ollama pull llama3.2:latest   # default, lightweight (recommended)
ollama pull tinyllama:latest   # very small, fastest
ollama pull llama2:7b          # larger, more capable
ollama pull llama4:latest      # latest generation
```

The app dynamically detects all installed Ollama models — you only need to pull the ones you want. Ollama must be running in the background while using the app. On macOS and Windows it starts automatically after installation. On Linux, start it manually with `ollama serve`.

### 6. Start the backend

```bash
cd backend
npm start
```

You should see `Server running on port 3000` and `MongoDB connected`. For development with auto-restart:

```bash
npm run dev
```

### 7. Start the frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Available Models

| Model | Provider | Requires |
|-------|----------|----------|
| Groq Llama 3.3 70B | Groq (cloud) | `GROQ_API_KEY` |
| Groq Llama 3.1 8B | Groq (cloud) | `GROQ_API_KEY` |
| llama3.2:latest | Ollama (local) | `ollama pull llama3.2:latest` |
| tinyllama:latest | Ollama (local) | `ollama pull tinyllama:latest` |
| llama2:7b | Ollama (local) | `ollama pull llama2:7b` |
| llama4:latest | Ollama (local) | `ollama pull llama4:latest` |

---

## Features

### Multi-Provider LLM Support
Route messages to Groq cloud models or locally-running Ollama models using a `provider:model` key format. All model selection is done from the UI — no code changes needed to switch providers.

### Compare Mode
Select multiple models simultaneously and receive responses from all of them side by side. Use the "Use this answer" button to keep one response and discard the others, collapsing the chat back to a single-model history.

### Document Upload and RAG
Upload PDF or plain text files (up to 10 MB). Uploaded documents are chunked, embedded using the `all-MiniLM-L6-v2` model locally via `@xenova/transformers`, and stored in MongoDB. When you send a message with documents selected, the top-K most relevant chunks are retrieved by cosine similarity and injected into the system prompt as context.

### Math Tool Calling
Ollama and Groq models have access to a `solve_math` tool backed by mathjs. When the model identifies a math question it calls the tool with a mathjs expression, receives the computed result, and formats the answer using LaTeX (`$...$` for inline, `$$...$$` for block). LaTeX is rendered in the frontend using KaTeX via `remark-math` and `rehype-katex`.

### Weather Tool Calling
Ollama and Groq models have access to a `get_weather` tool backed by the Open-Meteo API (no API key required). When the model identifies a weather question it calls the tool with a city name, receives current conditions and a forecast, and presents the result with temperature in °F and wind speed in mph.

### Chat History
All conversations are saved to MongoDB and accessible from the History page. Chats can be searched by title or message content with relevance scoring — exact title matches score highest, followed by partial matches and message hits. Matching chats include a snippet of the relevant message text.

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | No | Register a new user |
| `POST` | `/login` | No | Log in and receive a JWT |
| `GET` | `/user` | Yes | Get the authenticated user's profile |
| `POST` | `/forgot-password` | No | Send a password reset email |
| `POST` | `/reset-password/:token` | No | Reset password using a token |

### Chat (`/api/chat`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/models` | No | List all available models |
| `GET` | `/documents` | Yes | List uploaded documents |
| `POST` | `/documents/upload` | Yes | Upload a PDF or text document |
| `DELETE` | `/documents/:docId` | Yes | Delete a document |
| `POST` | `/new` | Yes | Create a new chat session |
| `GET` | `/` | Yes | List all chats |
| `GET` | `/search/:query` | Yes | Search chats by title and content |
| `GET` | `/:chatId` | Yes | Get a single chat |
| `POST` | `/:chatId` | Yes | Send a message |
| `PUT` | `/:chatId/select-output` | Yes | Select one model response in compare mode |
| `PUT` | `/:chatId/title` | Yes | Rename a chat |
| `DELETE` | `/:chatId` | Yes | Delete a chat |

---

## Project Structure

```
SWE_Project/
├── backend/
│   ├── models/          # Mongoose schemas (User, Chat, Document)
│   ├── routes/          # Express route handlers (auth, chat)
│   ├── middleware/       # JWT auth middleware
│   ├── utils/           # LLM providers, RAG, math/weather tools
│   ├── spec/            # Jasmine unit and integration tests
│   ├── features/        # Cucumber acceptance tests
│   └── index.js         # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── pages/       # React pages (Home, Login, Register, ChatHistory)
│   │   └── main.jsx     # React entry point
│   └── spec/            # Frontend Jasmine tests
└── UI-Testing/          # Puppeteer end-to-end tests
```
