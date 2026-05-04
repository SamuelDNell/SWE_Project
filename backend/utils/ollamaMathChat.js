const { ollamaChat } = require('./ollamaChat');

// Backward-compat shim — new code should import ollamaChat from ./ollamaChat
module.exports = { ollamaMathChat: ollamaChat };
