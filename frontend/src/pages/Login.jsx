import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                navigate('/home');
            } else {
                alert(data.msg); // "Invalid credentials"
            }
        } catch (err) {
            console.error(err);
            alert("Could not connect to server.");
        }
    };

    return(
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Welcome back!</h1>
                <div className={styles.field}>
                    <input
                        type="email"
                        placeholder=" "
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <label htmlFor="email">Email</label>
                </div>
                <div className={styles.field}>
                    <input
                        type="password"
                        placeholder=" "
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <label htmlFor="password">Password</label>
                </div>

                <button
                    className={styles.loginBtn}
                    onClick={handleLogin}
                >
                    Log In
                </button>

                <div className={styles.forgotPassword}>
                    <button
                        className={styles.forgotBtn}
                        onClick={() => navigate('/forgot-password')}
                    >
                        Forgot Password?
                    </button>
                </div>

                <button
                    className={styles.backBtn}
                    onClick={() => navigate('/')}
                >
                    Back
                </button>
            </div>
        </div>
    )
}