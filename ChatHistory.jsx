import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ChatHistory() {
  const navigate = useNavigate();
  const [allChats, setAllChats] = useState([]);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 🔹 Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  // 🔹 Load all chats initially
  const fetchChats = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("http://localhost:3000/api/chat", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAllChats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // 🔹 Search function
  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearched(false);
      setResults([]);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(
        `http://localhost:3000/api/chat/search/${encodeURIComponent(
          trimmedQuery
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      if (res.ok) setResults(data);
      else setResults([]);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Click chat → go to Home with state
  const handleClickChat = (id) => {
    navigate("/home", { state: { chatId: id } });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Chat History</h2>

      <button onClick={() => navigate("/home")}>Back to Chat</button>

      <div style={{ marginTop: "15px" }}>
        <input
          type="text"
          placeholder="Search chats..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "8px", width: "250px", marginRight: "10px" }}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      <div style={{ marginTop: "20px" }}>
        {loading && <p>Loading...</p>}

        {!loading && searched && results.length === 0 && <p>No results found.</p>}

        {!loading &&
          searched &&
          results.map((chat) => (
            <div
              key={chat._id}
              onClick={() => handleClickChat(chat._id)}
              style={{
                border: "1px solid #ccc",
                padding: "15px",
                marginBottom: "10px",
                cursor: "pointer",
                borderRadius: "8px",
              }}
            >
              <h3>{chat.title}</h3>
              <p style={{ color: "#666" }}>{chat.snippet}</p>
              <small>
                Score: {chat.score} <br />
                Last updated: {new Date(chat.updatedAt).toLocaleString()}
              </small>
            </div>
          ))}

        {!searched &&
          allChats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => handleClickChat(chat._id)}
              style={{
                border: "1px solid #ccc",
                padding: "15px",
                marginBottom: "10px",
                cursor: "pointer",
                borderRadius: "8px",
              }}
            >
              <h3>{chat.title}</h3>
              <small>
                Last updated: {new Date(chat.updatedAt).toLocaleString()}
              </small>
            </div>
          ))}
      </div>
    </div>
  );
}