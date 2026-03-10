import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div>
        <h1 style={{ marginBottom: "2rem"}}>LLM Web Interface</h1>
        <h2>Ask questions to our AI powered system!</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "300px", transform: "translateY(6rem)"}}>
        <button onClick={() => navigate('/login')}>Login</button>
        <button onClick={() => navigate('/create-account')}>Create Account</button>
        <button onClick={() => navigate('/login')}>Login with Rutgers CAS</button>
      </div>
    </div>
    </>
  )
}