import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Home.module.css'
import compareStyles from './CompareOverlay.module.css'

// ── Available models for comparison ──────────────────────────────────────────
const AVAILABLE_MODELS = [
    { value: "llama3.2:latest",     label: "Llama 3.2" },
    { value: "llama3.1:latest",     label: "Llama 3.1" },
    { value: "mistral:latest",      label: "Mistral" },
    { value: "gemma3:latest",       label: "Gemma 3" },
    { value: "phi3:latest",         label: "Phi-3" },
    { value: "qwen2:latest",        label: "Qwen 2" },
    { value: "deepseek-r1:latest",  label: "DeepSeek R1" },
    { value: "codellama:latest",    label: "Code Llama" },
];

// ── Model Picker Modal ────────────────────────────────────────────────────────
function ModelPickerModal({ onStart, onCancel, currentModel }) {
    const [modelA, setModelA] = useState(currentModel || AVAILABLE_MODELS[0].value);
    const [modelB, setModelB] = useState(AVAILABLE_MODELS[1].value);

    const canStart = modelA && modelB && modelA !== modelB;

    return (
        <div className={compareStyles.pickerBackdrop}>
            <div className={compareStyles.pickerModal}>
                <h3>Compare Models</h3>
                <p>Choose two models to compare side-by-side.</p>
                <div className={compareStyles.pickerColumns}>
                    <div className={compareStyles.pickerColumn}>
                        <label>Model A</label>
                        <select value={modelA} onChange={e => setModelA(e.target.value)}>
                            {AVAILABLE_MODELS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className={compareStyles.pickerColumn}>
                        <label>Model B</label>
                        <select value={modelB} onChange={e => setModelB(e.target.value)}>
                            {AVAILABLE_MODELS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {modelA === modelB && (
                    <p style={{ color: '#cc4444', fontSize: '0.82rem', marginBottom: 12 }}>
                        Please choose two different models.
                    </p>
                )}
                <div className={compareStyles.pickerActions}>
                    <button className={compareStyles.pickerCancelBtn} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className={compareStyles.pickerStartBtn}
                        disabled={!canStart}
                        onClick={() => onStart(modelA, modelB)}
                    >
                        Start Comparing →
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Compare Overlay ───────────────────────────────────────────────────────────
function CompareOverlay({ prompt, modelA, modelB, responseA, responseB, loadingA, loadingB, onSelect, onClose }) {
    const labelFor = (modelValue) =>
        AVAILABLE_MODELS.find(m => m.value === modelValue)?.label || modelValue;

    const bothDone = !loadingA && !loadingB;

    return (
        <div className={compareStyles.overlay}>
            {/* Header */}
            <div className={compareStyles.overlayHeader}>
                <div>
                    <h2>Model Comparison</h2>
                    <p className={compareStyles.overlaySubtext}>
                        Select the response you prefer — that model will become your active LLM.
                    </p>
                </div>
                <button className={compareStyles.overlayCloseBtn} onClick={onClose}>
                    ✕ Close
                </button>
            </div>

            {/* Prompt preview */}
            <div className={compareStyles.overlayPrompt}>
                <span>Prompt</span>
                <p>"{prompt}"</p>
            </div>

            {/* Side-by-side columns */}
            <div className={compareStyles.columns}>
                {/* Column A */}
                <div className={compareStyles.column}>
                    <div className={compareStyles.columnHeader}>
                        <div className={compareStyles.modelTag}>
                            <div className={`${compareStyles.modelDot} ${compareStyles.left}`} />
                            <span className={compareStyles.modelName}>{labelFor(modelA)}</span>
                        </div>
                    </div>
                    <div className={compareStyles.columnBody}>
                        {loadingA ? (
                            <div className={compareStyles.loadingDots}>
                                <span /><span /><span />
                            </div>
                        ) : (
                            <p className={compareStyles.responseText}>{responseA}</p>
                        )}
                    </div>
                    <div className={compareStyles.columnFooter}>
                        <button
                            className={`${compareStyles.selectBtn} ${compareStyles.left}`}
                            disabled={!bothDone}
                            onClick={() => onSelect(modelA)}
                        >
                            Use {labelFor(modelA)}
                        </button>
                    </div>
                </div>

                {/* Column B */}
                <div className={compareStyles.column}>
                    <div className={compareStyles.columnHeader}>
                        <div className={compareStyles.modelTag}>
                            <div className={`${compareStyles.modelDot} ${compareStyles.right}`} />
                            <span className={compareStyles.modelName}>{labelFor(modelB)}</span>
                        </div>
                    </div>
                    <div className={compareStyles.columnBody}>
                        {loadingB ? (
                            <div className={compareStyles.loadingDots}>
                                <span /><span /><span />
                            </div>
                        ) : (
                            <p className={compareStyles.responseText}>{responseB}</p>
                        )}
                    </div>
                    <div className={compareStyles.columnFooter}>
                        <button
                            className={`${compareStyles.selectBtn} ${compareStyles.right}`}
                            disabled={!bothDone}
                            onClick={() => onSelect(modelB)}
                        >
                            Use {labelFor(modelB)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Home Component ───────────────────────────────────────────────────────
export default function Home() {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    useEffect(() => {
        if (!token) navigate("/login");
    }, [token, navigate]);

    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [chats, setChats] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [model, setModel] = useState("llama3.2:latest");
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // ── Compare state ──────────────────────────────────────────────────────
    const [showPicker, setShowPicker] = useState(false);
    const [compareState, setCompareState] = useState(null);
    // compareState: { prompt, modelA, modelB, responseA, responseB, loadingA, loadingB }

    // ── Chat loading ───────────────────────────────────────────────────────
    useEffect(() => { loadChats(); }, []);

    useEffect(() => {
        if (location.state?.chatId) selectChat(location.state.chatId);
    }, [location.state]);

    const loadChats = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/chat", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const chatsData = await response.json();
                setChats(chatsData);
                if (!currentChatId && !location.state?.chatId && chatsData.length > 0) {
                    selectChat(chatsData[0]._id);
                }
            }
        } catch (err) { console.error("Error loading chats:", err); }
    };

    const selectChat = async (chatId) => {
        try {
            const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const chat = await response.json();
                setCurrentChatId(chatId);
                setMessages(chat.messages);
                setModel(chat.model);
            }
        } catch (err) { console.error("Error loading chat:", err); }
    };

    const createNewChat = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/chat/new", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title: "New Chat", model })
            });
            if (response.ok) {
                const newChat = await response.json();
                setChats(prev => [newChat, ...prev]);
                setCurrentChatId(newChat._id);
                setMessages([]);
            }
        } catch (err) { console.error("Error creating new chat:", err); }
    };

    // ── Send a single message to one model ────────────────────────────────
    const sendToModel = async (chatId, messageText, targetModel) => {
        const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: messageText, model: targetModel })
        });
        if (!response.ok) throw new Error(`Model ${targetModel} request failed`);
        return response.json();
    };

    // ── Ensure a chat exists, return its id ───────────────────────────────
    const ensureChatId = async (messageText) => {
        if (currentChatId) return currentChatId;
        const response = await fetch("http://localhost:3000/api/chat/new", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                title: messageText.length > 50 ? messageText.substring(0, 50) + "..." : messageText,
                model
            })
        });
        if (!response.ok) throw new Error("Failed to create chat");
        const newChat = await response.json();
        setChats(prev => [newChat, ...prev]);
        setCurrentChatId(newChat._id);
        return newChat._id;
    };

    // ── Normal send ───────────────────────────────────────────────────────
    const handleSend = async () => {
        if (input.trim() === "") return;
        const messageText = input;
        let chatId;
        try { chatId = await ensureChatId(messageText); }
        catch { alert("Could not create new chat"); return; }

        const userMessage = { role: "user", content: messageText };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const data = await sendToModel(chatId, messageText, model);
            setMessages(data.chat.messages);
            setChats(prev => prev.map(c => c._id === chatId ? data.chat : c));
        } catch (err) {
            console.error(err);
            alert("Could not connect to server.");
            setMessages(prev => prev.filter(m => m !== userMessage));
        } finally {
            setLoading(false);
        }
    };

    // ── Compare: open picker ──────────────────────────────────────────────
    const handleCompareClick = () => {
        if (!input.trim()) return;
        setShowPicker(true);
    };

    // ── Compare: fire both requests in parallel ───────────────────────────
    const handleStartCompare = async (modelA, modelB) => {
        setShowPicker(false);
        const prompt = input;

        // Show overlay immediately with loading state
        setCompareState({
            prompt,
            modelA, modelB,
            responseA: "", responseB: "",
            loadingA: true, loadingB: true,
        });

        // We need a chat to send against. Use the current one, or create a temp one.
        let chatId;
        try { chatId = await ensureChatId(prompt); }
        catch { alert("Could not create chat for comparison"); setCompareState(null); return; }

        // Fire both in parallel — each gets its own temporary chat so they don't
        // write conflicting messages into the same thread.
        const fetchForModel = async (targetModel) => {
            // Create a dedicated ephemeral chat for each comparison leg
            const res = await fetch("http://localhost:3000/api/chat/new", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title: `[compare] ${prompt.substring(0, 40)}`, model: targetModel })
            });
            if (!res.ok) throw new Error("Could not create comparison chat");
            const tempChat = await res.json();
            const data = await sendToModel(tempChat._id, prompt, targetModel);
            // Return just the assistant reply text
            const msgs = data.chat.messages;
            return msgs[msgs.length - 1]?.content || "(no response)";
        };

        // Run A and B concurrently, update state as each resolves
        const runA = fetchForModel(modelA).then(text => {
            setCompareState(prev => prev ? { ...prev, responseA: text, loadingA: false } : null);
        }).catch(() => {
            setCompareState(prev => prev ? { ...prev, responseA: "(error fetching response)", loadingA: false } : null);
        });

        const runB = fetchForModel(modelB).then(text => {
            setCompareState(prev => prev ? { ...prev, responseB: text, loadingB: false } : null);
        }).catch(() => {
            setCompareState(prev => prev ? { ...prev, responseB: "(error fetching response)", loadingB: false } : null);
        });

        await Promise.allSettled([runA, runB]);
    };

    // ── Compare: user picks a winner ──────────────────────────────────────
    const handleSelectModel = async (chosenModel) => {
        const prompt = compareState.prompt;
        setCompareState(null);
        setInput("");

        // Switch the active model
        setModel(chosenModel);

        // Now actually send the message into the main chat with the chosen model
        const userMessage = { role: "user", content: prompt };
        let chatId;
        try { chatId = await ensureChatId(prompt); }
        catch { alert("Could not send message"); return; }

        setMessages(prev => [...prev, userMessage]);
        setLoading(true);

        try {
            const data = await sendToModel(chatId, prompt, chosenModel);
            setMessages(data.chat.messages);
            setChats(prev => prev.map(c => c._id === chatId ? data.chat : c));
        } catch (err) {
            console.error(err);
            alert("Could not send message.");
            setMessages(prev => prev.filter(m => m !== userMessage));
        } finally {
            setLoading(false);
        }
    };

    // ── Logout / delete ───────────────────────────────────────────────────
    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate('/login');
    };

    const deleteChat = async (chatId, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this chat?")) return;
        try {
            const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                setChats(prev => prev.filter(c => c._id !== chatId));
                if (currentChatId === chatId) { setCurrentChatId(null); setMessages([]); }
            }
        } catch (err) { console.error("Error deleting chat:", err); }
    };

    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            {/* Model Picker */}
            {showPicker && (
                <ModelPickerModal
                    currentModel={model}
                    onStart={handleStartCompare}
                    onCancel={() => setShowPicker(false)}
                />
            )}

            {/* Compare Overlay */}
            {compareState && (
                <CompareOverlay
                    prompt={compareState.prompt}
                    modelA={compareState.modelA}
                    modelB={compareState.modelB}
                    responseA={compareState.responseA}
                    responseB={compareState.responseB}
                    loadingA={compareState.loadingA}
                    loadingB={compareState.loadingB}
                    onSelect={handleSelectModel}
                    onClose={() => setCompareState(null)}
                />
            )}

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
                            <div className={styles.chatTitle}>{chat.title}</div>
                            <div className={styles.chatDate}>
                                {new Date(chat.updatedAt).toLocaleDateString()}
                            </div>
                            <button
                                className={styles.deleteChat}
                                onClick={(e) => deleteChat(chat._id, e)}
                            >
                                🗑
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
                        <button onClick={() => navigate('/history')}>History</button>
                        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
                    </div>
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
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
                                >
                                    <div className={styles.messageContent}>{msg.content}</div>
                                </div>
                            ))}
                            {loading && (
                                <div className={`${styles.message} ${styles.assistant}`}>
                                    <div className={styles.messageContent}>Thinking...</div>
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
                        {/* ── Compare Button ── */}
                        <button
                            onClick={handleCompareClick}
                            disabled={loading || !input.trim()}
                            className={compareStyles.compareBtn}
                            title="Compare two models side-by-side"
                        >
                            <span className={compareStyles.compareIcon}>⚡</span>
                            Compare
                        </button>
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
