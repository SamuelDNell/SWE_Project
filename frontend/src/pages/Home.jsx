import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [chats, setChats] = useState(["Chat 1"]);
    const [showModal, setShowModal] = useState(false);
    const [model, setModel] = useState("llama2");
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
    if (input.trim() === "") return;

    const userMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5000/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                messages: updatedMessages,
                model: model
            })
        });
        const data = await response.json();

        if (response.ok) {
            const aiMessage = { role: "assistant", content: data.response.content };
            setMessages(prev => [...prev, aiMessage]);
        } else {
            alert(data.msg);
        }
    } catch (err) {
        console.error(err);
        alert("Could not connect to server.");
    } finally {
        setLoading(false);
    }
};

    const handleLogout = () => {
    localStorage.removeItem("token");
    navigate('/');
    };

    const handleNewChat = () => {
        setChats(prev => [...prev, `Chat ${prev.length + 1}`]);
        setMessages([]);
    };

    return (
        <div className={styles.page}>

            {showModal && (
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
                    <p className={styles.modalTitle}>Select Model</p>
                    <select
                        className={styles.modelSelect}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    >
                        <option value="llama2">llama2</option>
                        <option value="mistral">mistral</option>
                        <option value="codellama">codellama</option>
                        <option value="gemma">gemma</option>
                    </select>
                    <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                        Confirm
                    </button>
                </div>
            </div>
            )}

            {/* Sidebar */}
            <div className={styles.sidebar}>
                <button className={styles.newChatBtn} onClick={handleNewChat}>
                    + New Chat
                </button>
                <div className={styles.chatHistory}>
                    <p className={styles.historyLabel}>Chat history</p>
                    {chats.map((chat, i) => (
                        <div key={i} className={styles.chatItem}>{chat}</div>
                    ))}
                </div>
            </div>

            {/* Main area */}
            <div className={styles.main}>
                <div className={styles.topBar}>
                    <h1 className={styles.title}>Ask Knightly!</h1>
                    <button className={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
                    <button className={styles.settingsBtn} onClick={() => setShowModal(true)}>
                    Model
                    </button>
                </div>

                {/* Messages */}
                <div className={styles.messages}>
                    {messages.length === 0 && (
                        <p className={styles.placeholder}>Ask me anything...</p>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={msg.role === "user" ? styles.userMsg : styles.aiMsg}>
                            <span className={styles.roleLabel}>{msg.role === "user" ? "User" : "AI"}:</span>
                            <p>{msg.content}</p>
                        </div>
                    ))}
                    {loading && (
                        <div className={styles.aiMsg}>
                            <span className={styles.roleLabel}>AI:</span>
                            <p className={styles.typing}>
                                <span>.</span><span>.</span><span>.</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className={styles.inputRow}>
                    <input
                        type="text"
                        placeholder="Type your question here..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        className={styles.input}
                    />
                    <button className={styles.sendBtn} onClick={handleSend}>Send</button>
                </div>
            </div>
        </div>
    )
}