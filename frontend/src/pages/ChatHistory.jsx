import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTimestamp, getChatModeLabel } from '../utils/chat';

const API_BASE = 'http://localhost:3000';

export default function ChatHistory() {
  const navigate = useNavigate();
  const [allChats, setAllChats] = useState([]);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchChats();
  }, [navigate]);

  const fetchChats = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || 'Unable to load chat history');
      }

      setAllChats(data);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Unable to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearched(false);
      setResults([]);
      return;
    }

    setLoading(true);
    setSearched(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/chat/search/${encodeURIComponent(trimmedQuery)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || 'Search failed');
      }

      setResults(data);
    } catch (err) {
      console.error(err);
      setResults([]);
      setErrorMessage(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClickChat = (id) => {
    navigate('/home', { state: { chatId: id } });
  };

  const displayedChats = searched ? results : allChats;

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#f5f5f5', padding: '32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Chat History</h2>
            <p style={{ marginTop: '8px', color: '#b6b6b6' }}>
              Review your past conversations and reopen any chat to continue where you left off.
            </p>
          </div>

          <button
            onClick={() => navigate('/home')}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '12px 18px',
              background: '#cc0033',
              color: '#fff7f3',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Back to Chat
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search chats..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{
              flex: '1 1 320px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '14px 16px',
              fontSize: '15px',
              background: '#262626',
              color: '#f5f5f5'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '12px 18px',
              background: '#cc0033',
              color: '#fff7f3',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Search
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: '#fee2e2',
              color: '#991b1b'
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'grid', gap: '14px' }}>
          {loading && <p>Loading conversations...</p>}

          {!loading && displayedChats.length === 0 && searched && (
            <p>No results found.</p>
          )}

          {!loading && !searched && allChats.length === 0 && (
            <p>No conversations yet.</p>
          )}

          {!loading && displayedChats.map((chat) => (
            <button
              key={chat._id}
              type="button"
              onClick={() => handleClickChat(chat._id)}
              style={{
                textAlign: 'left',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#262626',
                color: '#f5f5f5',
                padding: '18px',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f5f5f5' }}>{chat.title}</h3>
                  <p style={{ margin: '8px 0 0', color: '#b6b6b6' }}>
                    Last updated: {formatTimestamp(chat.updatedAt)}
                  </p>
                </div>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    background: '#1e1e1e',
                    color: '#f5f5f5',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {getChatModeLabel(chat)}
                </span>
              </div>

              {searched && chat.snippet && (
                <p style={{ margin: '12px 0 0', color: '#d0d0d0', lineHeight: 1.5 }}>
                  {chat.snippet}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
