import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { useInvite } from '../../hooks/useInvite.js'
import { loginAccount } from '../../services/accountApi.js'
import Brand from '../../components/Brand/Brand.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from './LoginPage.module.css'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = useAuth()
  const invite = useInvite()
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setMessage('')
    try {
      const data = await loginAccount({ email: form.get('email'), password: form.get('password') })
      auth.acceptUser(data.user)
      navigate(invite.token ? '/entrar-grupo' + invite.suffix : data.user.playerTag ? '/home' : '/cadastro/tag', { replace: true })
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return (
    <main className={styles['login-page']}>
      <header className={styles['game-brand']}>
        <Brand variant="hero" tagline />
      </header>
      <section className={styles['login-card']} aria-labelledby="login-title">
        <div className={styles['card-heading']}>
          <p className={styles['eyebrow']}>PREPARE SEU DECK</p>
          <h1 id="login-title">De volta à arena!</h1>
          {invite.invite && <p className={styles.description}>Entre para participar de {invite.invite.name}.</p>}
          {invite.loading && <p className={styles.message}><LoadingIndicator inline>Conferindo convite…</LoadingIndicator></p>}
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
          <button className={styles['submit-button']} type="submit" disabled={busy} aria-busy={busy}>{busy ? <LoadingIndicator inline announce={false}>Entrando…</LoadingIndicator> : <>Entrar na arena <span aria-hidden="true">→</span></>}</button>
          <p className={styles['message']} role="status">{message}</p>
        </form>
        <p className={styles.footer}>
          Ainda não tem conta?{' '}
          <Link to={'/cadastro' + invite.suffix}>Cadastre-se agora</Link>
        </p>
      </section>
      <p className={styles['page-footer']}>MONTE SEU DECK. REÚNA OS AMIGUI. VÁ PRA BATALHA.</p>
    </main>
  )
}

export default LoginPage

