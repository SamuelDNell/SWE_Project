import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './ResetPassword.module.css'

export default function ResetPassword() {
    const navigate = useNavigate()
    const { token } = useParams()
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [validToken, setValidToken] = useState(true);

    useEffect(() => {
        // Check if token is valid (you could add a backend endpoint to verify token)
        if (!token) {
            setValidToken(false);
            setMessage("Invalid reset link");
        }
    }, [token]);

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            setMessage("Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            setMessage("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setMessage("Password must be at least 6 characters long");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch(`http://localhost:3000/api/auth/reset-password/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            const data = await response.json();

            if (response.ok) {
                setMessage("Password reset successful! Redirecting to login...");
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
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

    if (!validToken) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Invalid Reset Link</h1>
                    <p className={styles.subtitle}>This password reset link is invalid or has expired.</p>
                    <button
                        className={styles.backBtn}
                        onClick={() => navigate('/forgot-password')}
                    >
                        Request New Reset Link
                    </button>
                </div>
            </div>
        );
    }

    return(
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Reset Password</h1>
                <p className={styles.subtitle}>Enter your new password below.</p>

                <div className={styles.field}>
                    <input
                        type="password"
                        placeholder=" "
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <label htmlFor="password">New Password</label>
                </div>

                <div className={styles.field}>
                    <input
                        type="password"
                        placeholder=" "
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                </div>

                {message && (
                    <div className={styles.message}>
                        {message}
                    </div>
                )}

                <button
                    className={styles.resetBtn}
                    onClick={handleResetPassword}
                    disabled={loading}
                >
                    {loading ? "Resetting..." : "Reset Password"}
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