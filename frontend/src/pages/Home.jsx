import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import {
  formatTimestamp,
  getChatModeLabel,
  getComposerPlaceholder,
  getHeaderStatus,
  sortChatsByUpdatedAt
} from '../utils/chat';

const API_BASE = 'http://localhost:3000';
const DEFAULT_MODEL = 'llama3.2:latest';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [modelSelected, setModelSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectingModel, setSelectingModel] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    loadChats(location.state?.chatId);
  }, []);

  useEffect(() => {
    if (location.state?.chatId) {
      selectChat(location.state.chatId);
    }
  }, [location.state?.chatId]);

  const withAuthHeaders = (includeJson = false) => {
    const headers = {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    };

    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  };

  const updateChatList = (chat) => {
    setChats((prevChats) => {
      const nextChats = [chat, ...prevChats.filter((item) => item._id !== chat._id)];
      return sortChatsByUpdatedAt(nextChats);
    });
  };

  const syncChatState = (chat) => {
    setCurrentChatId(chat._id);
    setMessages(chat.messages || []);
    setActiveModel(chat.model || DEFAULT_MODEL);
    setModelSelected(Boolean(chat.modelSelected));
    updateChatList(chat);
  };

  const loadChats = async (preferredChatId = null) => {
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        headers: withAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Unable to load chats');
      }

      const chatsData = await response.json();
      setChats(chatsData);

      const chatIdToOpen = preferredChatId || currentChatId || chatsData[0]?._id;
      if (chatIdToOpen) {
        await selectChat(chatIdToOpen);
      } else {
        setMessages([]);
        setCurrentChatId(null);
        setModelSelected(false);
        setActiveModel(DEFAULT_MODEL);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      setErrorMessage('Unable to load your conversations right now.');
    }
  };

  const selectChat = async (chatId) => {
    try {
      const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
        headers: withAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Unable to load chat');
      }

      const chat = await response.json();
      syncChatState(chat);
      setErrorMessage('');
    } catch (error) {
      console.error('Error loading chat:', error);
      setErrorMessage('Unable to open that conversation.');
    }
  };

  const createNewChat = async (title = 'New Chat') => {
    const response = await fetch(`${API_BASE}/api/chat/new`, {
      method: 'POST',
      headers: withAuthHeaders(true),
      body: JSON.stringify({
        title,
        model: activeModel || DEFAULT_MODEL
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create new chat');
    }

    const newChat = await response.json();
    setMessages([]);
    setCurrentChatId(newChat._id);
    setActiveModel(newChat.model || DEFAULT_MODEL);
    setModelSelected(Boolean(newChat.modelSelected));
    updateChatList(newChat);
    return newChat;
  };

  const handleCreateNewChat = async () => {
    try {
      await createNewChat();
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setErrorMessage('Could not create a new chat.');
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    const previousMessages = messages;
    const optimisticMessages = [...messages, { role: 'user', content: trimmedInput }];

    setMessages(optimisticMessages);
    setInput('');
    setLoading(true);
    setErrorMessage('');

    try {
      let chatId = currentChatId;
      if (!chatId) {
        const newChat = await createNewChat(
          trimmedInput.length > 50 ? `${trimmedInput.slice(0, 50)}...` : trimmedInput
        );
        chatId = newChat._id;
      }

      const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
        method: 'POST',
        headers: withAuthHeaders(true),
        body: JSON.stringify({
          message: trimmedInput,
          model: activeModel
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Could not send message');
      }

      syncChatState(data.chat);
    } catch (error) {
      console.error(error);
      setMessages(previousMessages);
      setErrorMessage(error.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResponse = async (model) => {
    if (!currentChatId || selectingModel) return;

    setSelectingModel(model);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/chat/${currentChatId}/select`, {
        method: 'POST',
        headers: withAuthHeaders(true),
        body: JSON.stringify({ model })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Could not select response');
      }

      syncChatState(data.chat);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Could not select that response.');
    } finally {
      setSelectingModel('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const deleteChat = async (chatId, event) => {
    event.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this chat?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
        method: 'DELETE',
        headers: withAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Unable to delete chat');
      }

      const remainingChats = chats.filter((chat) => chat._id !== chatId);
      setChats(remainingChats);

      if (currentChatId === chatId) {
        const fallbackChat = remainingChats[0];
        if (fallbackChat) {
          await selectChat(fallbackChat._id);
        } else {
          setCurrentChatId(null);
          setMessages([]);
          setModelSelected(false);
          setActiveModel(DEFAULT_MODEL);
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setErrorMessage('Unable to delete that conversation.');
    }
  };

  const renderAssistantResponses = (message, index) => (
    <div key={`assistant-multi-${index}`} className={styles.multiResponseBlock}>
      <div className={styles.multiResponseHeader}>
        <h3>Model comparison</h3>
        <span className={styles.multiResponseHint}>One prompt, three outputs</span>
      </div>

      <div className={styles.responseGrid}>
        {message.responses.map((response) => {
          const isSelected = message.selectedModel === response.model;
          const isBusy = selectingModel === response.model;
          const buttonLabel = isSelected
            ? 'Selected'
            : isBusy
              ? 'Selecting...'
              : 'Continue with this response';

          return (
            <article
              key={`${index}-${response.model}`}
              className={`${styles.responseCard} ${isSelected ? styles.responseCardSelected : ''}`}
            >
              <div className={styles.responseCardHeader}>
                <div>
                  <p className={styles.responseModel}>{response.model}</p>
                  <p className={styles.responseStatus}>
                    {response.success ? 'Succeeded' : 'Failed'}
                  </p>
                </div>
                {isSelected && <span className={styles.selectedBadge}>Active</span>}
              </div>

              <div className={styles.responseContent}>
                {response.success ? response.content : response.error || 'This model did not return a response.'}
              </div>

              <button
                type="button"
                className={styles.selectBtn}
                onClick={() => handleSelectResponse(response.model)}
                disabled={!response.success || modelSelected || isBusy}
              >
                {buttonLabel}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );

  const renderMessage = (message, index) => {
    if (message.role === 'assistant_multi') {
      return renderAssistantResponses(message, index);
    }

    const isUser = message.role === 'user';
    const messageClasses = `${styles.message} ${isUser ? styles.user : styles.assistant}`;

    return (
      <div key={`${message.role}-${index}`} className={messageClasses}>
        <div className={styles.messageBubble}>
          {!isUser && message.model && (
            <div className={styles.messageMeta}>
              {message.model}
              {modelSelected && message.model === activeModel ? ' • active model' : ''}
            </div>
          )}
          <div className={styles.messageContent}>{message.content}</div>
        </div>
      </div>
    );
  };

  const emptyState = currentChatId
    ? {
        title: 'Ready when you are',
        description: 'Send one prompt to compare three model responses, then choose the one you want to continue with.'
      }
    : {
        title: 'Welcome to Knightly',
        description: 'Create a new chat and send one prompt to compare three model responses side by side.'
      };

  return (
    <div className={styles.container}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>
        <div className={styles.sidebarHeader}>
          <button className={styles.newChatBtn} onClick={handleCreateNewChat}>
            + New Chat
          </button>
          <button className={styles.toggleSidebar} onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '<' : '>'}
          </button>
        </div>

        <div className={styles.chatList}>
          {chats.length === 0 ? (
            <p className={styles.emptySidebar}>No conversations yet.</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat._id}
                className={`${styles.chatItem} ${currentChatId === chat._id ? styles.active : ''}`}
                onClick={() => selectChat(chat._id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectChat(chat._id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.chatItemText}>
                  <span className={styles.chatTitle}>{chat.title}</span>
                  <span className={styles.chatDate}>{formatTimestamp(chat.updatedAt)}</span>
                </div>
                <span className={styles.chatMode}>
                  {getChatModeLabel(chat)}
                </span>
                <button
                  type="button"
                  className={styles.deleteChat}
                  onClick={(event) => deleteChat(chat._id, event)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Knightly AI Assistant</h1>
            <p className={styles.headerStatus}>
              {getHeaderStatus(modelSelected, activeModel)}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/history')}>
              History
            </button>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className={styles.chatArea}>
          {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}

          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <h2>{emptyState.title}</h2>
              <p>{emptyState.description}</p>
            </div>
          ) : (
            <div className={styles.messages}>
              {messages.map(renderMessage)}
              {loading && (
                <div className={styles.loadingCard}>
                  {modelSelected
                    ? `Thinking with ${activeModel}...`
                    : 'Generating responses from three models...'}
                </div>
              )}
            </div>
          )}
        </section>

        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                getComposerPlaceholder(modelSelected, activeModel)
              }
              disabled={loading}
              className={styles.input}
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className={styles.sendBtn}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
