import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CreateAccount.module.css'

export default function SignUp() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [reenter, setReenter] = useState("");

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Create An Account!</h1>
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

                <div className = {styles.field}>
                    <input
                    type="password"
                    placeholder=" "
                    id = "confirm"
                    value = {reenter}
                    onChange = {(e) => setReenter(e.target.value)}
                    />
                    <label htmlFor="confirm">Reenter Password</label>
                </div>

                {/* DELETE THIS, JUST FOR TESTING PURPOSES*/}
                <div className={styles.debugBox}>
                    <p>Email: {email}</p>
                    <p>Password: {password}</p>
                    <p>Reentered Password: {reenter}</p>
                    <p>Passwords Match: {password === "" ? "Need inputs" : (password===reenter? "T":"F")}</p>
                </div>
                <button
                    className={styles.signUpBtn}
                    onClick={() => navigate('/')}
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