import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import styles from './Home.module.css'

const DEFAULT_MODEL_OPTIONS = [
    'groq:llama-3.3-70b-versatile',
    'groq:llama-3.1-8b-instant',
    'ollama:llama3.2:latest',
    'ollama:llama2:7b',
    'ollama:llama4:latest'
];

export default function Home() {
    const navigate = useNavigate();
const token = localStorage.getItem("token");

useEffect(() => {
  if (!token) {
    navigate("/login");
  }
}, [token, navigate]);

    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [chats, setChats] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [model, setModel] = useState("groq:llama-3.3-70b-versatile");
    const [availableModels, setAvailableModels] = useState(DEFAULT_MODEL_OPTIONS);
    const [selectedModels, setSelectedModels] = useState(["groq:llama-3.3-70b-versatile"]);
    const [compareMode, setCompareMode] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [modelSelectorOpen, setModelSelectorOpen] = useState(true);

    const handleInvalidToken = () => {
        localStorage.removeItem('token');
        alert('Session expired or invalid. Please log in again.');
        navigate('/login');
    };

    // Load chats, models, and documents on component mount
    useEffect(() => {
        loadChats();
        loadModels();
        loadDocuments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
    if (location.state?.chatId) {
        selectChat(location.state.chatId);
    }
}, [location.state]);

    const loadDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/api/chat/documents', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const docs = await response.json();
                setDocuments(docs);
                setSelectedDocuments(docs.map((doc) => doc._id));
            }
        } catch (err) {
            console.error('Error loading documents:', err);
        }
    };

    const loadModels = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/chat/models");
            if (response.ok) {
                const data = await response.json();
                const fetchedModels = data.models?.map((item) => item.name) || [];
                const mergedModels = Array.from(new Set([...fetchedModels, ...DEFAULT_MODEL_OPTIONS]));
                setAvailableModels(mergedModels);
                if (mergedModels.length > 0) {
                    const defaults = mergedModels.slice(0, 2);
                    setSelectedModels(defaults.length ? defaults : ["groq:llama-3.3-70b-versatile"]);
                    setModel(defaults[0] || "groq:llama-3.3-70b-versatile");
                }
            } else {
                setAvailableModels(DEFAULT_MODEL_OPTIONS);
            }
        } catch (err) {
            console.error("Error loading models:", err);
            setAvailableModels(DEFAULT_MODEL_OPTIONS);
        }
    };

    const uploadDocument = async (file) => {
        setUploadError(null);
        setUploadingDoc(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('document', file);

            const response = await fetch('http://localhost:3000/api/chat/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const doc = await response.json();
                setDocuments((prev) => [...prev, doc]);
                setSelectedDocuments((prev) => [...new Set([...prev, doc._id])]);
            } else {
                const errorData = await response.json();
                setUploadError(errorData.msg || 'Unable to upload document');
            }
        } catch (err) {
            console.error('Error uploading document:', err);
            setUploadError('Upload failed. Please try again.');
        } finally {
            setUploadingDoc(false);
        }
    };

    const deleteDocument = async (docId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3000/api/chat/documents/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setDocuments((prev) => prev.filter((d) => d._id !== docId));
                setSelectedDocuments((prev) => prev.filter((id) => id !== docId));
            }
        } catch (err) {
            console.error('Error deleting document:', err);
        }
    };

    const handleDocumentToggle = (docId) => {
        setSelectedDocuments((prev) => {
            if (prev.includes(docId)) {
                return prev.filter((id) => id !== docId);
            }
            return [...prev, docId];
        });
    };

    const loadChats = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:3000/api/chat", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                const chatsData = await response.json();
                setChats(chatsData);

                if (!currentChatId && !location.state?.chatId && chatsData.length > 0) {
                    selectChat(chatsData[0]._id);
                }
            } else if (response.status === 401) {
                handleInvalidToken();
            }
        } catch (err) {
            console.error("Error loading chats:", err);
        }
    };

    const selectChat = async (chatId) => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                const chat = await response.json();
                const chatModels = chat.models?.length ? chat.models : [chat.model || "groq:llama-3.3-70b-versatile"];
                const firstModel = chat.model || chatModels[0] || "groq:llama-3.3-70b-versatile";
                const chatDocs = (chat.documents || []).map((doc) => typeof doc === 'string' ? doc : doc._id);
                setCurrentChatId(chatId);
                setMessages(chat.messages);
                setModel(firstModel);
                setSelectedModels(chatModels);
                setSelectedDocuments(chatDocs);
                setCompareMode(chatModels.length > 1);
            } else if (response.status === 401) {
                handleInvalidToken();
            }
        } catch (err) {
            console.error("Error loading chat:", err);
        }
    };

    const createNewChat = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:3000/api/chat/new", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: "New Chat",
                    model: compareMode ? (selectedModels[0] || model) : model,
                    models: compareMode ? selectedModels : [model],
                    documentIds: selectedDocuments
                })
            });

            if (response.ok) {
                const newChat = await response.json();
                setChats(prev => [newChat, ...prev]);
                setCurrentChatId(newChat._id);
                setMessages([]);
            } else {
                const errorData = await response.json();
                if (response.status === 401) {
                    handleInvalidToken();
                    return;
                }
                console.error('Create chat failed:', errorData);
                alert(`Failed to create new chat: ${errorData.msg || 'Server error'}`);
            }
        } catch (err) {
            console.error("Error creating new chat:", err);
        }
    };

    const handleSend = async () => {
        if (input.trim() === "") return;

        // If no current chat, create a new one first
        let chatId = currentChatId;
        if (!chatId) {
            try {
                const token = localStorage.getItem("token");
                const createResponse = await fetch("http://localhost:3000/api/chat/new", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: input.length > 50 ? input.substring(0, 50) + "..." : input,
                        model: compareMode ? (selectedModels[0] || model) : model,
                        models: compareMode ? selectedModels : [model],
                        documentIds: selectedDocuments
                    })
                });

                if (createResponse.ok) {
                    const newChat = await createResponse.json();
                    setChats(prev => [newChat, ...prev]);
                    setCurrentChatId(newChat._id);
                    chatId = newChat._id;
                } else {
                    const errorData = await createResponse.json();
                    if (createResponse.status === 401) {
                        handleInvalidToken();
                        return;
                    }
                    console.error("Chat creation error:", errorData);
                    alert(`Failed to create new chat: ${errorData.msg || 'Unknown error'}`);
                    return;
                }
            } catch (err) {
                console.error("Error creating new chat:", err);
                alert("Could not create new chat");
                return;
            }
        }

        const userMessage = { role: "user", content: input };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setLoading(true);

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: input,
                    models: compareMode ? selectedModels : [model],
                    documentIds: selectedDocuments
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data.chat.messages);
                setChats(prev => prev.map(chat =>
                    chat._id === chatId ? data.chat : chat
                ));
                if (data.failedModels?.length) {
                    console.warn('Some models failed:', data.failedModels);
                    alert(`Note: ${data.failedModels.map((f) => `${formatModelLabel(f.model)} failed — ${f.error}`).join('\n')}`);
                }
            } else {
                const errorData = await response.json();
                alert(errorData.msg || 'Chat request failed');
                setMessages(messages);
            }
        } catch (err) {
            console.error(err);
            alert("Could not connect to server.");
            // Remove the user message if there was an error
            setMessages(messages);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate('/login');
    };

    const getLastAssistantResponses = () => {
        const lastUserIndex = messages
            .map((message, index) => (message.role === 'user' ? index : -1))
            .filter((index) => index !== -1)
            .pop();

        if (lastUserIndex === undefined || lastUserIndex === -1) {
            return [];
        }

        return messages.slice(lastUserIndex + 1).filter((message) => message.role === 'assistant');
    };

    const handleSelectModelResponse = async (selectedModel) => {
        if (!currentChatId) return;

        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:3000/api/chat/${currentChatId}/select-output`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ model: selectedModel })
            });

            if (response.ok) {
                const updatedChat = await response.json();
                setMessages(updatedChat.messages);
                setChats((prev) => prev.map((chat) =>
                    chat._id === currentChatId ? updatedChat : chat
                ));
                setModel(selectedModel);
                setSelectedModels([selectedModel]);
                setCompareMode(false);
            } else if (response.status === 401) {
                handleInvalidToken();
            } else {
                const errorData = await response.json();
                alert(`Could not select response: ${errorData.msg || 'Server error'}`);
            }
        } catch (err) {
            console.error('Error selecting model response:', err);
            alert('Could not select model response.');
        } finally {
            setLoading(false);
        }
    };

    const deleteChat = async (chatId, e) => {
        e.stopPropagation(); // Prevent selecting the chat

        if (!confirm("Are you sure you want to delete this chat?")) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                setChats(prev => prev.filter(chat => chat._id !== chatId));
                if (currentChatId === chatId) {
                    setCurrentChatId(null);
                    setMessages([]);
                }
            }
        } catch (err) {
            console.error("Error deleting chat:", err);
        }
    };

    const formatModelLabel = (modelKey) => {
        const labelMap = {
            'groq:llama-3.3-70b-versatile': 'Groq Llama 3.3 70B',
            'groq:llama-3.1-8b-instant': 'Groq Llama 3.1 8B',
        };
        if (labelMap[modelKey]) return labelMap[modelKey];
        const prefixes = ['groq', 'ollama'];
        for (const prefix of prefixes) {
            if (modelKey.startsWith(prefix + ':')) {
                return modelKey.slice(prefix.length + 1);
            }
        }
        return modelKey;
    };

    return (
        <div className={styles.container}>
            {/* Sidebar */}
            <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>
                <div className={styles.sidebarHeader}>
                    <button className={styles.newChatBtn} onClick={createNewChat}>
                        + New Chat
                    </button>
                    <button className={styles.toggleSidebar} onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? '◁' : '▷'}
                    </button>
                </div>

                <div className={styles.chatList}>
                    {chats.map(chat => (
                        <div
                            key={chat._id}
                            className={`${styles.chatItem} ${currentChatId === chat._id ? styles.active : ''}`}
                            onClick={() => selectChat(chat._id)}
                        >
                            <div className={styles.chatTitle}>
                                {chat.title}
                            </div>
                            <div className={styles.chatDate}>
                                {new Date(chat.updatedAt || chat.createdAt).toLocaleDateString()}
                            </div>
                            <button
                                className={styles.deleteChat}
                                onClick={(e) => deleteChat(chat._id, e)}
                                aria-label="Delete chat"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={styles.main}>
            <div className={styles.header}>
    <h1>Knightly AI Assistant</h1>

    <div>
        <button className={styles.historyBtn} onClick={() => navigate('/history')}>
            History
        </button>

        <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
        </button>
    </div>
</div>

            <div className={styles.modelSelector}>
                <div className={styles.modelSelectorHeader}>
                    <div>
                        <p className={styles.modelModeLabel}>Model selection</p>
                        {modelSelectorOpen && (
                            <span className={styles.modelModeDescription}>
                                {compareMode ? 'Compare multiple model outputs' : 'Use a single model response'}
                            </span>
                        )}
                    </div>
                    <div className={styles.modelSelectorActions}>
                        {modelSelectorOpen && (
                            <button
                                type="button"
                                className={styles.compareToggleBtn}
                                onClick={() => {
                                    if (compareMode) {
                                        const firstSelected = selectedModels[0] || model;
                                        setModel(firstSelected);
                                        setSelectedModels([firstSelected]);
                                    } else {
                                        setSelectedModels((prev) => (prev.length > 0 ? prev : [model]));
                                    }
                                    setCompareMode((prev) => !prev);
                                }}
                            >
                                {compareMode ? 'Switch to single model' : 'Switch to compare mode'}
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.collapseBtn}
                            onClick={() => setModelSelectorOpen((prev) => !prev)}
                            aria-label={modelSelectorOpen ? 'Collapse model selector' : 'Expand model selector'}
                        >
                            {modelSelectorOpen ? '▲' : '▼'}
                        </button>
                    </div>
                </div>
                {modelSelectorOpen && (compareMode ? (
                    <div className={styles.modelOptions}>
                        {availableModels.map((option) => (
                            <label key={option} className={styles.modelOption}>
                                <input
                                    type="checkbox"
                                    checked={selectedModels.includes(option)}
                                    onChange={() => {
                                        const alreadySelected = selectedModels.includes(option);
                                        const nextSelection = alreadySelected
                                            ? selectedModels.filter((value) => value !== option)
                                            : [...selectedModels, option];

                                        if (nextSelection.length === 0) {
                                            return;
                                        }
                                        setSelectedModels(nextSelection);
                                        setModel(nextSelection[0]);
                                    }}
                                />
                                {formatModelLabel(option)}
                            </label>
                        ))}
                    </div>
                ) : (
                    <div className={styles.modelDropdown}>
                        <label htmlFor="model-select">Select model:</label>
                        <select
                            id="model-select"
                            value={model}
                            onChange={(e) => {
                                setModel(e.target.value);
                                setSelectedModels([e.target.value]);
                            }}
                            className={styles.modelSelect}
                        >
                            {availableModels.map((option) => (
                                <option key={option} value={option}>
                                    {formatModelLabel(option)}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}

                {modelSelectorOpen && <div className={styles.documentSection}>
                    <div className={styles.documentHeader}>
                        <p className={styles.modelModeLabel}>Uploaded documents</p>
                        <span className={styles.modelModeDescription}>
                            Upload files and use them as context for model responses.
                        </span>
                    </div>
                    <div className={styles.uploadRow}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,text/plain"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadDocument(file);
                            }}
                            className={styles.fileInput}
                        />
                        <button
                            type="button"
                            className={styles.compareToggleBtn}
                            disabled={uploadingDoc}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploadingDoc ? 'Uploading…' : 'Choose document'}
                        </button>
                    </div>
                    {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
                    <div className={styles.documentList}>
                        {documents.map((doc) => (
                            <div key={doc._id} className={styles.documentRow}>
                                <label className={styles.modelOption}>
                                    <input
                                        type="checkbox"
                                        checked={selectedDocuments.includes(doc._id)}
                                        onChange={() => handleDocumentToggle(doc._id)}
                                    />
                                    {doc.filename}
                                </label>
                                <button
                                    type="button"
                                    className={styles.deleteDocBtn}
                                    onClick={() => deleteDocument(doc._id)}
                                    aria-label="Delete document"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        {documents.length === 0 && (
                            <p className={styles.modelModeDescription}>No uploaded documents yet.</p>
                        )}
                    </div>
                </div>}
            </div>

                <div className={styles.chatArea}>
                    {messages.length === 0 && currentChatId ? (
                        <div className={styles.welcome}>
                            <h2>How can I help you today?</h2>
                            <p>Start a conversation with the AI assistant.</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className={styles.welcome}>
                            <h2>Welcome to Knightly!</h2>
                            <p>Start typing your message below to begin chatting with the AI assistant.</p>
                        </div>
                    ) : (
                        <div className={styles.messages}>
                            {messages.map((msg, index) => {
                                const lastAssistantResponses = getLastAssistantResponses();
                                const lastUserIndex = messages
                                    .map((message, idx) => (message.role === 'user' ? idx : -1))
                                    .filter((idx) => idx !== -1)
                                    .pop();
                                const isLatestAssistantResponse = lastUserIndex !== undefined && index > lastUserIndex && msg.role === 'assistant';
                                const showSelectButton = compareMode && lastAssistantResponses.length > 1 && isLatestAssistantResponse;

                                return (
                                    <div
                                        key={index}
                                        className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
                                    >
                                        <div className={styles.messageContent}>
                                            {msg.role === 'assistant' && msg.model && (
                                                <div className={styles.messageModelLabel}>{formatModelLabel(msg.model)}</div>
                                            )}
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                            {showSelectButton && msg.model && (
                                                <div className={styles.messageActions}>
                                                    <button
                                                        className={styles.selectResponseBtn}
                                                        type="button"
                                                        onClick={() => handleSelectModelResponse(msg.model)}
                                                        disabled={loading}
                                                    >
                                                        Use this answer
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {loading && (
                                <div className={`${styles.message} ${styles.assistant}`}>
                                    <div className={styles.messageContent}>
                                        Thinking...
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.inputArea}>
                    <div className={styles.inputContainer}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type your message..."
                            disabled={loading}
                            className={styles.input}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className={styles.sendBtn}
                        >
                            {loading ? '...' : 'Send'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
