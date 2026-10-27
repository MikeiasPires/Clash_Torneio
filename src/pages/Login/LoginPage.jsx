import { useState } from 'react'
import styles from './LoginPage.module.css'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setMessage('A autenticação ainda não está conectada. O login estará disponível em breve.')
  }

  return (
    <main className={styles['login-page']}>
      <header className={styles['game-brand']}>
        <div className={styles['brand-mark']} aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none">
            <path d="M12 22 27 32 40 15 53 32 68 22 61 57H19L12 22Z" fill="currentColor" />
            <path d="M22 64H58" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            <path d="m40 34 6 9-6 9-6-9 6-9Z" fill="#1555a0" />
          </svg>
        </div>
        <p className={styles['brand-name']}>Clash <span>dos Amigui</span></p>
        <p className={styles['brand-tagline']}>A resenha é nossa. A arena também.</p>
      </header>
      <section className={styles['login-card']} aria-labelledby="login-title">
        <div className={styles['card-heading']}>
          <p className={styles['eyebrow']}>PREPARE SEU DECK</p>
          <h1 id="login-title">De volta à arena!</h1>
        </div>
        <form onSubmit={handleSubmit} onChange={() => setMessage('')}>
          <div className={styles['field']}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="voce@exemplo.com" required />
          </div>
          <div className={styles['field']}>
            <label htmlFor="password">Senha</label>
            <div className={styles['password-field']}>
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" required />
              <button className={styles['password-toggle']} type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <button className={styles['submit-button']} type="submit">Entrar na arena <span aria-hidden="true">→</span></button>
          <p className={styles['message']} role="status">{message}</p>
        </form>
      </section>
      <p className={styles['page-footer']}>MONTE SEU DECK. REÚNA OS AMIGUI. VÁ PRA BATALHA.</p>
    </main>
  )
}

export default LoginPage

