import {
  formatTimestamp,
  getChatModeLabel,
  getComposerPlaceholder,
  getHeaderStatus,
  sortChatsByUpdatedAt
} from '../src/utils/chat.js';

describe('chat utils', () => {
  it('sorts chats by most recent updatedAt first', () => {
    const chats = [
      { _id: '1', updatedAt: '2026-04-20T10:00:00.000Z' },
      { _id: '2', updatedAt: '2026-04-22T10:00:00.000Z' },
      { _id: '3', updatedAt: '2026-04-21T10:00:00.000Z' }
    ];

    const sorted = sortChatsByUpdatedAt(chats);
    expect(sorted.map((chat) => chat._id)).toEqual(['2', '3', '1']);
  });

  it('returns the correct mode label for compare mode and selected mode', () => {
    expect(getChatModeLabel({ modelSelected: false, model: 'llama3.2:latest' })).toBe('Compare mode');
    expect(getChatModeLabel({ modelSelected: true, model: 'qwen3:latest' })).toBe('qwen3:latest');
  });

  it('returns context-aware header and composer text', () => {
    expect(getHeaderStatus(false, 'llama3.2:latest')).toContain('Compare mode');
    expect(getHeaderStatus(true, 'gemma3:4b')).toBe('Active model: gemma3:4b');
    expect(getComposerPlaceholder(false, 'llama3.2:latest')).toContain('compare three models');
    expect(getComposerPlaceholder(true, 'qwen3:latest')).toBe('Continue chatting with qwen3:latest...');
  });

  it('formats timestamps and falls back for missing values', () => {
    expect(formatTimestamp('2026-04-23T12:00:00.000Z')).toContain('2026');
    expect(formatTimestamp()).toBe('Just now');
  });
});
