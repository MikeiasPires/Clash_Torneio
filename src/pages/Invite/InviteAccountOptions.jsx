import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from './InvitePage.module.css'

export default function InviteAccountOptions({ suffix, disabled = false, showContinue = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function switchAccount(destination) {
    setBusy(destination); setError('')
    try { await logout(() => navigate(destination + suffix, { replace: true })) }
    catch (error) { setError(error.message) }
    finally { setBusy('') }
  }

  return <section className={styles.account} aria-label="Escolher a conta para o convite">
    <p className={styles.label}>CONTA CONECTADA NESTE NAVEGADOR</p>
    <p className={styles.email}>{user.email}</p>
    {user.playerTag && <p className={styles.tag}>{user.playerName} · {user.playerTag}</p>}
    <p className={styles.help}>Cada jogador entra com sua própria conta e informa a tag do jogo. Se o convite é para outra pessoa, crie ou acesse a conta dela.</p>
    <div className={styles.actions}>
      {showContinue && <button className={styles.primary} type="button" disabled={disabled || busy} onClick={() => navigate('/entrar-grupo' + suffix, { replace: true })}>Continuar com esta conta</button>}
      <button type="button" disabled={Boolean(disabled || busy)} aria-busy={busy === '/cadastro'} onClick={() => void switchAccount('/cadastro')}>{busy === '/cadastro' ? <LoadingIndicator inline announce={false}>Aguarde…</LoadingIndicator> : 'Criar outra conta'}</button>
      <button type="button" disabled={Boolean(disabled || busy)} aria-busy={busy === '/login'} onClick={() => void switchAccount('/login')}>{busy === '/login' ? <LoadingIndicator inline announce={false}>Aguarde…</LoadingIndicator> : 'Entrar com outra conta'}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>
}
