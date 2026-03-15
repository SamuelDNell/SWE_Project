import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.css'

export default function ForgotPassword() {
    const navigate = useNavigate()
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleForgotPassword = async () => {
        if (!email) {
            setMessage("Please enter your email address");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (response.ok) {
                setMessage("Password reset email sent! Check your inbox.");
            } else {
                setMessage(data.msg);
            }
        } catch (err) {
            console.error(err);
            setMessage("Could not connect to server.");
        } finally {
            setLoading(false);
        }
    };

    return(
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Forgot Password</h1>
                <p className={styles.subtitle}>Enter your email address and we'll send you a link to reset your password.</p>

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

                {message && (
                    <div className={styles.message}>
                        {message}
                    </div>
                )}

                <button
                    className={styles.resetBtn}
                    onClick={handleForgotPassword}
                    disabled={loading}
                >
                    {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <button
                    className={styles.backBtn}
                    onClick={() => navigate('/login')}
                >
                    Back to Login
                </button>
            </div>
        </div>
    )
}