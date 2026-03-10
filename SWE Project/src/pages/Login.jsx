import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
    const navigate = useNavigate()

    return(
        <>
        <div style = {{ display:"flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "translateY(9rem)", gap: "2rem"}}>
            <label for="username">Username:</label>
            <input type="text" id="username" placeholder="Enter username" />
            <label for="password">Password:</label>
            <input type="text" id="password" placeholder="Enter password" />
        </div>
        <div>
            <button 
            onClick = {() => navigate('/')}
            style = {{ position: "fixed", bottom: "2rem", left: "50%"}}>
                Back
            </button>
        </div>
        </>
    )
}