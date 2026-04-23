import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const pageStyles = {
  maxWidth: "980px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#111827",
};

const headerStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "24px",
};

const searchRowStyles = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
  marginBottom: "20px",
};

const inputStyles = {
  flex: "1 1 280px",
  minWidth: "240px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  fontSize: "0.95rem",
};

const primaryButton = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  background: "#CC0033",
  color: "#fff",
  fontWeight: 600,
};

const secondaryButton = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  cursor: "pointer",
  background: "#f8fafc",
  color: "#111827",
  fontWeight: 600,
};

const cardStyles = {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "20px",
  paddingRight: "44px",
  marginBottom: "16px",
  background: "#ffffff",
  cursor: "pointer",
  transition: "transform 0.12s ease, box-shadow 0.12s ease",
};

const cardHoverStyles = {
  transform: "translateY(-1px)",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
};

const deleteButtonStyles = {
  position: "absolute",
  top: "12px",
  right: "12px",
  padding: "0",
  width: "24px",
  height: "24px",
  border: "none",
  background: "transparent",
  color: "#6b7280",
  fontSize: "18px",
  lineHeight: "1",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function ChatHistory() {
  const navigate = useNavigate();
  const [allChats, setAllChats] = useState([]);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

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
        `http://localhost:3000/api/chat/search/${encodeURIComponent(trimmedQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setResults(res.ok ? data : []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearched(false);
    setResults([]);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  const [hoverDeleteId, setHoverDeleteId] = useState(null);

  const handleClickChat = (id) => {
    navigate("/home", { state: { chatId: id } });
  };

  const handleDeleteChat = async (chatId, event) => {
    event.stopPropagation();

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/chat/${chatId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setAllChats((prev) => prev.filter((chat) => chat._id !== chatId));
        setResults((prev) => prev.filter((chat) => chat._id !== chatId));
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  const displayedChats = searched ? results : allChats;
  const sortedChats = [...displayedChats].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div style={pageStyles}>
      <div style={headerStyles}>
        <div>
          <p style={{ margin: 0, color: "#ffffff" }}>Your saved chats in one place</p>
          <h1 style={{ margin: "8px 0 0", fontSize: "2rem", color: "#ffffff" }}>Chat History</h1>
        </div>

        <button style={primaryButton} onClick={() => navigate("/home")}>Back to Chat</button>
      </div>

      <div style={searchRowStyles}>
        <input
          type="text"
          placeholder="Search title or message text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyles}
        />
        <button style={primaryButton} onClick={handleSearch} disabled={loading}>
          Search
        </button>
        <button style={secondaryButton} onClick={handleClear}>
          Clear
        </button>
      </div>

      <div style={{ marginBottom: "20px", color: "#ffffff"}}>
        <strong>{searched ? "Search results" : "Recent chats"}</strong>
        <p style={{ margin: "8px 0 0", color: "#ffffff" }}>
          {sortedChats.length === 0
            ? searched
              ? "No matching chats found."
              : "No chat history yet. Start a conversation to save one."
            : `${sortedChats.length} chat${sortedChats.length === 1 ? "" : "s"} found.`}
        </p>
      </div>

      {loading && <p>Loading...</p>}

      {!loading &&
        sortedChats.map((chat) => {
          const hoverStyle = hoveredId === chat._id ? { ...cardStyles, ...cardHoverStyles } : cardStyles;

          return (
            <div
              key={chat._id}
              style={{ ...hoverStyle, position: "relative" }}
              onClick={() => handleClickChat(chat._id)}
              onMouseEnter={() => setHoveredId(chat._id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                style={deleteButtonStyles}
                onClick={(event) => handleDeleteChat(chat._id, event)}
                aria-label="Delete chat"
              >
                ×
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: "220px" }}>
                  <h3 style={{ margin: "0 0 10px" }}>{chat.title || "Untitled chat"}</h3>
                  {searched && chat.snippet && (
                    <p style={{ margin: 0, color: "#4b5563" }}>{chat.snippet}</p>
                  )}
                </div>

                <div style={{ textAlign: "right", minWidth: "180px" }}>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>Created</p>
                  <p style={{ margin: "6px 0 0", fontWeight: 600 }}>
                    {new Date(chat.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "18px", color: "#374151" }}>
                <span>Model: {chat.model || "Unknown"}</span>
                <span>Messages: {chat.messageCount ?? chat.messages?.length ?? 0}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
