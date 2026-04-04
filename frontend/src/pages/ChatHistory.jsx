import {useState} from 'react';
import {useNavigate} from 'react-router-dom';

export default function ChatHistory() {
    const navigate = useNavigate();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);

        try {
            const token = localStorage.getItem("token");

            const response = await fetch(
                `http://localhost:3000/api/chat/search/${query}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                console.error("Search failed");
            }
        } catch (err) {
            console.error("Error searching:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleClickChat = (chatId) => {
        navigate('/home', { state: { chatId } });
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>Chat History</h1>

            {/* 🔍 Search Bar */}
            <div style={{ marginBottom: "20px" }}>
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    style={{ padding: "10px", width: "300px" }}
                />
                <button onClick={handleSearch} style={{ marginLeft: "10px" }}>
                    Search
                </button>
            </div>

            {/* ⏳ Loading */}
            {loading && <p>Searching...</p>}

            {/* 📊 Results */}
            <div>
                {results.length === 0 && !loading && (
                    <p>No results yet. Try searching something.</p>
                )}

                {results.map((chat) => (
                    <div
                        key={chat._id}
                        onClick={() => handleClickChat(chat._id)}
                        style={{
                            border: "1px solid #ccc",
                            padding: "15px",
                            marginBottom: "10px",
                            cursor: "pointer",
                            borderRadius: "8px"
                        }}
                    >
                        <h3>{chat.title}</h3>

                        <p style={{ color: "#666" }}>
                            {chat.snippet}
                        </p>

                        <small>
                            Last updated: {new Date(chat.updatedAt).toLocaleString()}
                        </small>
                    </div>
                ))}
            </div>
        </div>
    );
}
