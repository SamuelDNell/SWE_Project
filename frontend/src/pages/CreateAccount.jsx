import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CreateAccount.module.css'

export default function SignUp() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [reenter, setReenter] = useState("");

    const handleSignUp = async () => {
        if (password !== reenter) {
            alert("Passwords do not match!");
            return;
        }
        try {
            const response = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                navigate('/home');
            } else {
                alert(data.msg);
            }
        } catch (err) {
            console.error(err);
            alert("Could not connect to server.");
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Create An Account!</h1>

                <div className={styles.field}>
                    <input
                        type="text"
                        placeholder=" "
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <label htmlFor="username">Username</label>
                </div>

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

                <div className={styles.field}>
                    <input
                        type="password"
                        placeholder=" "
                        id="confirm"
                        value={reenter}
                        onChange={(e) => setReenter(e.target.value)}
                    />
                    <label htmlFor="confirm">Reenter Password</label>
                </div>
                <button
                    className={styles.signUpBtn}
                    onClick={handleSignUp}
                >
                    Sign Up
                </button>
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