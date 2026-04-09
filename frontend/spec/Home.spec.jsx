import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../src/Home';

describe('Home Component', () => {
  const mockChats = [
    { _id: '1', title: 'Chat One', updatedAt: new Date(), messages: [] },
    { _id: '2', title: 'Chat Two', updatedAt: new Date(), messages: [] },
  ];

  beforeEach(() => {
    global.fetch = jest.fn((url, options) => {
      if (url.includes('/api/chat/new')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ _id: '3', title: 'New Chat', messages: [] }),
        });
      }

      if (url.includes('/api/chat/')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                chat: { _id: '1', messages: [{ role: 'user', content: 'Hello' }] },
              }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockChats),
          });
        }
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders chats in sidebar', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const chatOne = await screen.findByText('Chat One');
    const chatTwo = await screen.findByText('Chat Two');

    expect(chatOne).toBeInTheDocument();
    expect(chatTwo).toBeInTheDocument();
  });

  it('can create a new chat', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const newChatButton = screen.getByText('+ New Chat');
    fireEvent.click(newChatButton);

    const newChat = await screen.findByText('New Chat');
    expect(newChat).toBeInTheDocument();
  });

  it('can send a message', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Set up input
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      const userMessage = screen.getByText('Hello');
      expect(userMessage).toBeInTheDocument();
    });
  });

  it('can select a chat', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const chatOne = await screen.findByText('Chat One');
    fireEvent.click(chatOne);

    const welcomeText = await screen.findByText(/How can I help you today/i);
    expect(welcomeText).toBeInTheDocument();
  });
});
