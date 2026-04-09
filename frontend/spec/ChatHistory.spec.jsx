import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatHistory from '../src/ChatHistory';

describe('ChatHistory Component', () => {
  const mockChats = [
    { _id: '1', title: 'Chat One', updatedAt: new Date(), messages: [] },
    { _id: '2', title: 'Chat Two', updatedAt: new Date(), messages: [] },
  ];

  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url.includes('/search/')) {
        const query = url.split('/search/')[1];
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              mockChats.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase()))
            ),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockChats),
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders all chat titles', async () => {
    render(
      <MemoryRouter>
        <ChatHistory />
      </MemoryRouter>
    );

    const chatOne = await screen.findByText('Chat One');
    const chatTwo = await screen.findByText('Chat Two');

    expect(chatOne).toBeInTheDocument();
    expect(chatTwo).toBeInTheDocument();
  });

  it('searches chats correctly', async () => {
    render(
      <MemoryRouter>
        <ChatHistory />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText('Search chats...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(input, { target: { value: 'One' } });
    fireEvent.click(searchButton);

    const chatOne = await screen.findByText('Chat One');
    expect(chatOne).toBeInTheDocument();
    expect(screen.queryByText('Chat Two')).toBeNull();
  });
});
