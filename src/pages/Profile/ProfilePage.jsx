import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import ProfileSettingsModal from './ProfileSettingsModal.jsx'
import ProfileIcon from './ProfileIcon.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from './ProfilePage.module.css'

function ProfilePage() {
  const auth = useAuth()
  const user = auth.user
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function logout() {
    setBusy(true); setMessage(''); setError('')
    try { await auth.logout(); navigate('/login', { replace: true }) }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <section className={styles.page} aria-labelledby="profile-title">
    <div className={styles.pageHeading}><span>MINHA CONTA</span><span className={styles.privateBadge}><ProfileIcon name="shield" /> Seu espaço</span></div>
    <header className={styles.identity}>
      <div className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt={`Foto de ${user.name}`} /> : <span aria-hidden="true">{user.name.charAt(0)}</span>}</div>
      <p className={styles.role}>{user.isAdmin ? 'ADMINISTRADOR' : 'JOGADOR'}</p><h1 id="profile-title">{user.name}</h1>
      <span className={styles.gameIdentity}>{user.playerTag ? `${user.playerName} · ${user.playerTag}` : 'Seu perfil na arena dos amigos'}</span>
      <button className={styles.editButton} type="button" disabled={busy} onClick={() => { setMessage(''); setError(''); setEditing(true) }}><ProfileIcon name="edit" /> Editar perfil</button>
    </header>
    <section className={styles.card} aria-labelledby="profile-details-title">
      <div className={styles.cardHeading}><h2 id="profile-details-title">Informações pessoais</h2><ProfileIcon name="user" /></div>
      <dl className={styles.details}>
        {[['user', 'Nome no perfil', user.name], ['email', 'E-mail', user.email], ['age', 'Idade', `${user.age} anos`], ['tag', 'Tag do Clash Royale', user.playerTag || 'Não vinculada']].map(([icon, label, value]) => <div className={styles.detailRow} key={icon}>
          <dt><span className={styles.detailIcon}><ProfileIcon name={icon} /></span>{label}</dt><dd>{value}</dd>
        </div>)}
      </dl>
      <p className={styles.privacy}><ProfileIcon name="shield" /> E-mail e idade são visíveis só para você.</p>
    </section>
    <section className={styles.phraseCard} aria-labelledby="profile-phrase-title"><div className={styles.phraseHeading}><ProfileIcon name="quote" /><h2 id="profile-phrase-title">Minha frase</h2></div>
      <p className={user.phrase ? styles.phraseText : styles.emptyPhrase}>{user.phrase || 'Seu próximo x1 merece uma boa frase.'}</p>
      <span>{user.phrase ? 'Seu recado aparece na home quando você liderar o grupo.' : 'Adicione a sua em Editar perfil.'}</span>
    </section>
    <p className={styles.message} role="status">{message}</p>{error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.logout} type="button" disabled={busy} aria-busy={busy} onClick={() => void logout()}>{busy ? <LoadingIndicator inline announce={false}>Saindo…</LoadingIndicator> : <><ProfileIcon name="logout" />Sair da conta</>}</button>
    {editing && <ProfileSettingsModal user={user} onDismiss={() => setEditing(false)} onSaved={message => { setEditing(false); setMessage(message) }} />}
  </section>
}
export default ProfilePage
