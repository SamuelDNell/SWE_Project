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
- Placeholder for password reset functionality

### REST API
- Express.js server with CORS and JSON middleware
- Modular routing structure for auth and chat endpoints
- Error handling for API requests
- Proxy endpoints to Ollama for LLM interactions
- Model listing endpoint to query available Ollama models
- Chat endpoint supporting conversational message format

### Database
- MongoDB integration using Mongoose ODM
- User model with fields: username, email, password, createdAt
- Connection handling with environment variable configuration
- Schema validation for user data

### API Endpoints

- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/user - Get user info (requires auth)
- POST /api/auth/reset-password - Reset password (placeholder)
- GET /api/chat/models - Get list of available Ollama models
- POST /api/chat - Send chat message to Ollama (requires auth)

## Frontend Setup
Similar to backend, navigate to frontend using cd and then npm install, followed by npm run dev
