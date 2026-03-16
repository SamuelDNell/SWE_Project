# Unit Testing with Jasmine

This project includes comprehensive unit tests using the Jasmine testing framework to ensure the web user interface for LLM inference works correctly.

## Test Results ✅

### Backend Tests
- **Status**: ✅ All tests passing
- **Specs**: 9 specs, 0 failures
- **Coverage**: Authentication API endpoints (registration, login, user info)

### Frontend Tests
- **Status**: ✅ All tests passing
- **Specs**: 14 specs, 0 failures
- **Coverage**: UI components, forms, browser storage, API integration

## Features Tested

### 1. Landing Page ✅
- Basic DOM structure and element presence
- Welcome message display

### 2. User Account Creation ✅
- Successful user registration
- Duplicate email prevention
- Required field validation
- Password confirmation matching
- Username length validation

### 3. User Login/Logout ✅
- Successful authentication with valid credentials
- Invalid credential rejection
- Token-based user info retrieval
- Proper logout functionality
- JWT token storage in localStorage

## Running the Tests

### Backend API Tests
```bash
cd backend
npm test
```

### Frontend UI Tests
```bash
cd frontend
npm test
```

## Test Structure

### Backend Tests (`/backend/spec/`)
- **auth.spec.js**: Tests for authentication endpoints
  - User registration API
  - User login API
  - User info retrieval API

### Frontend Tests (`/frontend/spec/`)
- **ui.spec.js**: Tests for user interface components
  - Landing page functionality
  - Login form validation
  - Registration form validation
  - Chat interface elements
  - Browser storage operations
  - API integration availability

## Testing Setup

### Backend Testing
- **Framework**: Jasmine with jasmine-supertest
- **Database**: MongoDB test database
- **Environment**: NODE_ENV=test for conditional server startup
- **Dependencies**: supertest for HTTP testing

### Frontend Testing
- **Framework**: Jasmine with jasmine-dom
- **Browser Simulation**: jsdom for DOM environment
- **Mocking**: Custom mocks for localStorage and fetch API
- **Environment**: ES modules with helper setup

## Configuration Files

- `backend/spec/support/jasmine.json`: Backend test configuration
- `frontend/spec/support/jasmine.json`: Frontend test configuration
- `frontend/spec/helpers/setup.js`: Browser environment setup for frontend tests
  - API integration mocking

## Test Dependencies

### Backend
- `jasmine`: Testing framework
- `jasmine-supertest`: HTTP endpoint testing
- `supertest`: API testing utilities

### Frontend
- `jasmine`: Testing framework
- `jasmine-dom`: DOM testing utilities

## Test Coverage

The tests cover the three main requirements:

1. **Landing Page**: Ensures the initial page loads correctly
2. **User Account Creation**: Validates the registration process
3. **Login/Logout**: Confirms authentication flow works properly

All tests are designed to run independently and include proper setup/teardown to ensure test isolation.