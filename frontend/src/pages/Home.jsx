import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Home.module.css'

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
    const [showModal, setShowModal] = useState(false);
    const [model, setModel] = useState("llama3.2:latest"); //updated default model to match backend
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sendMode, setSendMode] = useState("llama3.2:latest"); 
    const [options, setOptions] = useState([]);
    const [availableModels, setAvailableModels] = useState([
        { id: "llama3.2:latest", name: "Llama 3.2" },
        { id: "compare", name: "Compare 3 LLMs" }
    ]);

    // Load chats and models on component mount
    useEffect(() => {
        loadChats();
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/chat/models");
            if (response.ok) {
                const data = await response.json();
                const models = data.models.map(m => ({
                    id: m.name,
                    name: m.name.split(':')[0].toUpperCase().replace(/-/g, ' ')
                }));
                setAvailableModels([...models, { id: "compare", name: "Compare 3 LLMs" }]);
                
                // Set default sendMode if current one isn't in available models
                if (!models.find(m => m.id === sendMode) && models.length > 0) {
                    setSendMode(models[0].id);
                }
            }
        } catch (err) {
            console.error("Error loading models:", err);
        }
    };

    useEffect(() => {
    if (location.state?.chatId) {
        selectChat(location.state.chatId);
    }
}, [location.state]);
    
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
                setCurrentChatId(chatId);
                setMessages(chat.messages);
                setModel(chat.model);
                setOptions([]); // Clear options when switching chats
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
                    model: model
                })
            });

            if (response.ok) {
                const newChat = await response.json();
                setChats(prev => [newChat, ...prev]);
                setCurrentChatId(newChat._id);
                setMessages([]);
                setOptions([]);
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
                        model: sendMode === "compare" ? "llama3.2:latest" : sendMode
                    })
                });

                if (createResponse.ok) {
                    const newChat = await createResponse.json();
                    setChats(prev => [newChat, ...prev]);
                    setCurrentChatId(newChat._id);
                    chatId = newChat._id;
                } else {
                    alert("Failed to create new chat");
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
        const originalInput = input;
        setInput("");
        setLoading(true);
        setOptions([]);

        const isCompare = sendMode === "compare";
        const top3Models = availableModels
            .filter(m => m.id !== "compare")
            .slice(0, 3)
            .map(m => m.id);

        try {
            const token = localStorage.getItem("token");
            const endpoint = isCompare ? `http://localhost:3000/api/chat/${chatId}/multi` : `http://localhost:3000/api/chat/${chatId}`;
            
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: originalInput,
                    model: sendMode,
                    models: top3Models
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (isCompare) {
                    setOptions(data.options);
                    setMessages(data.chat.messages);
                } else {
                    setMessages(data.chat.messages);
                }
                
                setChats(prev => prev.map(chat =>
                    chat._id === chatId ? (data.chat || chat) : chat
                ));
            } else {
                const errorData = await response.json();
                alert(errorData.msg);
                setMessages(messages);
            }
        } catch (err) {
            console.error(err);
            alert("Could not connect to server.");
            setMessages(messages);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOption = async (option) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:3000/api/chat/${currentChatId}/choose`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    content: option.content,
                    model: option.model
                })
            });

            if (response.ok) {
                const updatedChat = await response.json();
                setMessages(updatedChat.messages);
                setOptions([]);
                setChats(prev => prev.map(chat =>
                    chat._id === currentChatId ? updatedChat : chat
                ));
            } else {
                alert("Failed to save selection");
            }
        } catch (err) {
            console.error("Error selecting option:", err);
            alert("Error saving selection");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate('/login');
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
                                {new Date(chat.updatedAt).toLocaleDateString()}
                            </div>
                            <button
                                className={styles.deleteChat}
                                onClick={(e) => deleteChat(chat._id, e)}
                            >
                                
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
        <button onClick={() => navigate('/history')}>
            History
        </button>

        <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
        </button>
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
                                    {msg.role === 'assistant' && msg.model && (
                                        <div className={styles.messageModel}>{msg.model}</div>
                                    )}
                                    <div className={styles.messageContent}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            
                            {options.length > 0 && (
                                <div className={styles.optionsContainer}>
                                    <h3>Choose the best response:</h3>
                                    <div className={styles.optionsGrid}>
                                        {options.map((opt, i) => (
                                            <div key={i} className={styles.optionCard}>
                                                <div className={styles.optionHeader}>{opt.model}</div>
                                                <div className={styles.optionContent}>{opt.content}</div>
                                                <button 
                                                    className={styles.selectBtn}
                                                    onClick={() => handleSelectOption(opt)}
                                                    disabled={loading}
                                                >
                                                    Select this response
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loading && options.length === 0 && (
                                <div className={`${styles.message} ${styles.assistant}`}>
                                    <div className={styles.messageContent}>
                                        {sendMode === "compare" ? 'Generating multiple responses...' : 'Thinking...'}
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
                        <div className={styles.sendControls}>
                            <select 
                                className={styles.modelSelect}
                                value={sendMode}
                                onChange={(e) => setSendMode(e.target.value)}
                                disabled={loading}
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
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
        </div>
    );
}
