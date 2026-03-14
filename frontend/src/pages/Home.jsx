import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [chats, setChats] = useState(["Chat 1"]);

    const handleSend = async () => {
        if (input.trim() === "") return;

        const userMessage = { role: "user", content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");

        // TODO: replace with real backend call
        const aiMessage = { role: "ai", content: "This is a placeholder response." };
        setMessages(prev => [...prev, aiMessage]);
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
                    <h1 className={styles.title}>LLM Interface</h1>
                    <button className={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
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