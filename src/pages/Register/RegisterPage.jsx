import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { useInvite } from '../../hooks/useInvite.js'
import { registerAccount } from '../../services/accountApi.js'
import PhotoField from '../../components/PhotoField/PhotoField.jsx'
import Brand from '../../components/Brand/Brand.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from '../Login/LoginPage.module.css'

function RegisterPage() {
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const auth = useAuth()
  const invite = useInvite()
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setMessage('')
    try {
      const data = await registerAccount({ name: form.get('name'), age: Number(form.get('age')), email: form.get('email'), password: form.get('password'), photo, ...(invite.token ? { invite: invite.token } : {}) })
      auth.acceptUser(data.user)
      navigate('/cadastro/tag' + invite.suffix, { replace: true })
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return (
    <main className={styles['login-page']}>
      <header className={styles['game-brand']}><Brand /></header>
      <section className={styles['login-card']} aria-labelledby="register-title">
        <div className={styles['card-heading']}>
          <p className={styles.eyebrow}>ENTRE PARA A ARENA</p>
          <h1 id="register-title">Crie sua conta</h1>
          <p className={styles.description}>{invite.invite ? `Você foi convidado para ${invite.invite.name}. Crie sua conta e, em seguida, informe sua tag do Clash Royale.` : 'Crie sua conta e, na próxima etapa, informe sua tag do Clash Royale.'}</p>
          {invite.loading && <p className={styles.message}><LoadingIndicator inline>Conferindo convite…</LoadingIndicator></p>}
          {invite.error && <p className={styles.message} role="alert">{invite.error}</p>}
        </div>
        <form onSubmit={handleSubmit} onChangeCapture={() => setMessage('')}>
          <div className={styles.field}>
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" autoComplete="name" maxLength={100} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="age">Idade</label>
            <input id="age" name="age" type="number" inputMode="numeric" min={1} max={120} step={1} required />
          </div>
          <PhotoField value={photo} onChange={setPhoto} onError={setMessage} disabled={busy} />
          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Senha (mínimo de 10 caracteres)</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
          </div>
          <button className={styles['submit-button']} type="submit" disabled={busy || Boolean(invite.token && !invite.invite)} aria-busy={busy}>{busy ? <LoadingIndicator inline announce={false}>Criando conta…</LoadingIndicator> : 'Criar conta e continuar'}</button>
          <p className={styles.message} role="status">{message}</p>
        </form>
        <p className={styles.footer}>Já tem conta? <Link to={'/login' + invite.suffix}>Entrar</Link></p>
      </section>
    </main>
  )
}

export default RegisterPage
