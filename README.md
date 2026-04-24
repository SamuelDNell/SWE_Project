# SWE_Project
Bhanavi Senthil (bs1121) Individual Iteration
## Backend Setup

1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Ensure MongoDB is running locally or update MONGODB_URI
5. Ensure Ollama is running locally with the models used by this project:
   - `llama3.2:latest`
   - `qwen3:latest`
   - `gemma3:4b`
6. Run the server: `npm run dev`

### Authentication
- JWT-based authentication system for secure user sessions
- Password hashing using bcryptjs for secure storage
- Middleware to verify tokens on protected routes
- User registration with email and username validation
- Login endpoint returning JWT tokens
- Protected user info endpoint
- Password reset functionality with email verification
- Secure token-based password reset with expiration

### REST API
- Express.js server with CORS and JSON middleware
- Modular routing structure for auth and chat endpoints
- Error handling for API requests
- Proxy endpoints to Ollama for LLM interactions
- Model listing endpoint to query available Ollama models
- Chat endpoints supporting both multi-model comparison and single-model continuation
- Chat history and chat search endpoints for authenticated users
- Response-selection endpoint to choose one model output and continue the conversation with it

### Database
- MongoDB integration using Mongoose ODM
- User model with fields: username, email, password, resetPasswordToken, resetPasswordExpires, createdAt
- Chat model with fields: user, title, messages[], model, modelSelected, createdAt, updatedAt
- Message sub-schema with support for standard assistant messages and grouped multi-model responses
- Connection handling with environment variable configuration
- Schema validation for user and chat data

### API Endpoints

- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/user - Get user info (requires auth)
- POST /api/auth/forgot-password - Request password reset email
- POST /api/auth/reset-password/:token - Reset password with token
- POST /api/auth/reset-password - Reset password (placeholder)
- GET /api/chat - Get all user chats (requires auth)
- GET /api/chat/search/:query - Search chats for the logged-in user (requires auth)
- GET /api/chat/:chatId - Get specific chat (requires auth)
- POST /api/chat/new - Create new chat (requires auth)
- POST /api/chat/:chatId - Send message in chat (requires auth)
- POST /api/chat/:chatId/select - Select one model response and continue with that model (requires auth)
- PUT /api/chat/:chatId/title - Update chat title (requires auth)
- DELETE /api/chat/:chatId - Delete chat (requires auth)
- GET /api/chat/models - Get list of available Ollama models
- POST /api/chat - Send chat message to Ollama (requires auth)

## Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Run the frontend: `npm run dev`

### Frontend Features
- Login, account creation, and password reset pages
- Chat interface that sends one prompt to three LLMs and displays all three responses
- Ability to select one response and continue the conversation with that model only
- Chat history page with recent-first ordering and search

## Testing

- Backend unit tests: `cd backend && npm test`
- Frontend unit tests: `cd frontend && npm test`
- UI/Cucumber tests: `cd UI-Testing && npm test`
- Puppeteer demo: `cd UI-Testing && npm run demo`

See [TESTING.md](./TESTING.md) for more detailed testing instructions.
