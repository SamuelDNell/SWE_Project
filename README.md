# SWE_Project

## Backend Setup

1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Set up environment variables in `.env` (copy from `.env` file)
4. Ensure MongoDB is running locally or update MONGODB_URI
5. Ensure Ollama is running locally
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
- Chat endpoint supporting conversational message format

### Database
- MongoDB integration using Mongoose ODM
- User model with fields: username, email, password, resetPasswordToken, resetPasswordExpires, createdAt
- Chat model with fields: user, title, messages[], model, createdAt, updatedAt
- Message sub-schema with fields: role, content, timestamp
- Connection handling with environment variable configuration
- Schema validation for user and chat data

### API Endpoints

### API Endpoints

- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/user - Get user info (requires auth)
- POST /api/auth/forgot-password - Request password reset email
- POST /api/auth/reset-password/:token - Reset password with token
- POST /api/auth/reset-password - Reset password (placeholder)
- GET /api/chat - Get all user chats (requires auth)
- GET /api/chat/:chatId - Get specific chat (requires auth)
- POST /api/chat/new - Create new chat (requires auth)
- POST /api/chat/:chatId - Send message in chat (requires auth)
- PUT /api/chat/:chatId/title - Update chat title (requires auth)
- DELETE /api/chat/:chatId - Delete chat (requires auth)
- GET /api/chat/models - Get list of available Ollama models
- POST /api/chat - Send chat message to Ollama (requires auth)

## Frontend Setup
Similar to backend, navigate to frontend using cd and then npm install, followed by npm run dev
