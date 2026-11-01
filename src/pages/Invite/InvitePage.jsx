import { Navigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { useInvite } from '../../hooks/useInvite.js'
import InviteAccountOptions from './InviteAccountOptions.jsx'
import styles from '../Login/LoginPage.module.css'

function InvitePage() {
  const { user, loading } = useAuth()
  const invite = useInvite()
  if (loading) return <p className="session-loading" role="status">Abrindo convite…</p>
  if (!user) return <Navigate to={'/cadastro' + invite.suffix} replace />
  return <main className={styles['login-page']}><section className={styles['login-card']} aria-labelledby="invite-title">
    <div className={styles['card-heading']}><p className={styles.eyebrow}>CONVITE PARA A TURMA</p><h1 id="invite-title">Como você quer entrar?</h1>
      <p className={styles.description}>{invite.invite ? `Você recebeu um convite para ${invite.invite.name}.` : 'Conferindo o convite do grupo…'}</p></div>
    {invite.loading && <p className={styles.message} role="status">Conferindo convite…</p>}
    {invite.error && <p className={styles.message} role="alert">{invite.error}</p>}
    <InviteAccountOptions suffix={invite.suffix} disabled={!invite.invite} showContinue />
  </section></main>
}
export default InvitePage
