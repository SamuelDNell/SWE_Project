import { useNavigate } from 'react-router-dom'
import styles from './Landing.module.css'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className = {styles.page}>
      <div>
        <h1 className = {styles.title}>Welcome to Knightly!</h1>
        <h2 className = {styles.subtitle}>Ask questions to our AI powered system!</h2>
        <h3 className = {styles.subsubtitle}>Made by Scarlet Knights, for Scarlet Knights.</h3>
      </div>
      <div className = {styles.card}>
        <button className = {styles.navBtn} onClick={() => navigate ('/login')}>Log in</button>
        <button className = {styles.navBtn} onClick={() => navigate ('/create-account')}>Create an account</button>
      </div>
    </div>
  )
}