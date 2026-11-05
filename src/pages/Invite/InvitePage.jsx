import { Navigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { useInvite } from '../../hooks/useInvite.js'
import InviteAccountOptions from './InviteAccountOptions.jsx'
import Brand from '../../components/Brand/Brand.jsx'
import SessionLoading from '../../components/SessionLoading/SessionLoading.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from '../Login/LoginPage.module.css'

function InvitePage() {
  const { user, loading } = useAuth()
  const invite = useInvite()
  if (loading) return <SessionLoading>Abrindo convite…</SessionLoading>
  if (!user) return <Navigate to={'/cadastro' + invite.suffix} replace />
  return <main className={styles['login-page']}>
    <header className={styles['game-brand']}><Brand /></header>
    <section className={styles['login-card']} aria-labelledby="invite-title">
    <div className={styles['card-heading']}><p className={styles.eyebrow}>CONVITE PARA A TURMA</p><h1 id="invite-title">Como você quer entrar?</h1>
      {invite.invite && <p className={styles.description}>Você recebeu um convite para {invite.invite.name}.</p>}</div>
    {invite.loading && <p className={styles.message}><LoadingIndicator inline>Conferindo convite…</LoadingIndicator></p>}
    {invite.error && <p className={styles.message} role="alert">{invite.error}</p>}
    <InviteAccountOptions suffix={invite.suffix} disabled={!invite.invite} showContinue />
  </section></main>
}
export default InvitePage
