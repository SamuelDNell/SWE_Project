const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot')
.then(() => console.log('MongoDB connected'))
.catch(err => {
    console.log('MongoDB connection error:', err);
    process.exit(1);
});

// Routes
console.log('Loading auth routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('Loading chat routes...');
app.use('/api/chat', require('./routes/chat'));
console.log('Routes loaded successfully');

const PORT = process.env.PORT || 3000;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;