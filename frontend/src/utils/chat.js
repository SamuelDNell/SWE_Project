export function formatTimestamp(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString();
}

export function sortChatsByUpdatedAt(chats) {
  return [...chats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getChatModeLabel(chat) {
  return chat?.modelSelected ? chat.model : 'Compare mode';
}

export function getComposerPlaceholder(modelSelected, activeModel) {
  return modelSelected
    ? `Continue chatting with ${activeModel}...`
    : 'Send one prompt to compare three models...';
}

export function getHeaderStatus(modelSelected, activeModel) {
  return modelSelected
    ? `Active model: ${activeModel}`
    : 'Compare mode: send one prompt, review all three responses, then select one to continue.';
}
