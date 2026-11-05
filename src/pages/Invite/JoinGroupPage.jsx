import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { useInvite } from '../../hooks/useInvite.js'
import { joinInvite, linkPlayer } from '../../services/accountApi.js'
import { normalizePlayerTag } from '../../../shared/playerTag.js'
import InviteAccountOptions from './InviteAccountOptions.jsx'
import Brand from '../../components/Brand/Brand.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import styles from '../Login/LoginPage.module.css'
import inviteStyles from './InvitePage.module.css'

function JoinGroupPage({ registration = false }) {
  const auth = useAuth()
  return <JoinGroupForm key={auth.user.id} registration={registration} />
}

function JoinGroupForm({ registration }) {
  const auth = useAuth()
  const invite = useInvite()
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const linkingOnly = registration && !invite.token
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const selectedTag = normalizePlayerTag(tag)
      if (auth.user.playerTag && auth.user.playerTag !== selectedTag) throw new Error(linkingOnly
        ? `Esta conta já usa a tag ${auth.user.playerTag}. Não é possível trocar a tag vinculada.`
        : 'Esta conta já usa a tag ' + auth.user.playerTag + '. Para cadastrar outro jogador, use “Criar outra conta” ou “Entrar com outra conta” abaixo.')
      if (linkingOnly) {
        const result = await linkPlayer(selectedTag)
        auth.acceptUser(result.user)
        navigate('/perfil', { replace: true })
        return
      }
      const result = await joinInvite(invite.token, selectedTag)
      await auth.refresh()
      try { localStorage.setItem('x1:group', result.groupId) } catch { /* O grupo também está no endereço de destino. */ }
      navigate('/historico?grupo=' + result.groupId, { replace: true })
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <main className={styles['login-page']}>
    <header className={styles['game-brand']}><Brand /></header>
    <section className={styles['login-card']} aria-labelledby="join-title">
    <div className={styles['card-heading']}><p className={styles.eyebrow}>{registration ? 'ETAPA 2 · SUA CONTA NO JOGO' : 'FALTA SÓ SUA TAG'}</p><h1 id="join-title">{linkingOnly ? 'Adicione sua tag' : 'Entre na turma'}</h1>
      <p className={styles.description}>{linkingOnly ? 'Falta só vincular seu jogador do Clash Royale ao seu perfil.' : invite.invite ? `Informe sua tag para entrar em ${invite.invite.name}.` : 'Informe sua tag para participar do grupo.'}</p></div>
    {invite.loading && <p className={styles.message}><LoadingIndicator inline>Conferindo convite…</LoadingIndicator></p>}
    {invite.error && <p className={styles.message} role="alert">{invite.error}</p>}
    <form onSubmit={submit}>
      <div className={styles.field}><label htmlFor="join-tag">Tag do Clash Royale</label>
        <input id="join-tag" value={tag} onChange={event => { setTag(event.target.value); setError('') }} placeholder="Digite sua tag, ex.: #P0LYQ" maxLength={16} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="join-tag-help" disabled={busy} required /></div>
      <p id="join-tag-help" className={styles.help}>Informe a tag de quem está entrando. No Clash Royale, abra o perfil e copie o código que começa com #. A letra O será interpretada como zero.</p>
      {auth.user.playerTag && <div className={inviteStyles.linkedTag}><p>Esta conta já está vinculada a <strong>{auth.user.playerTag}</strong>. Para cadastrar outra pessoa, use a conta dela.</p><button className={inviteStyles.useTag} type="button" disabled={busy} onClick={() => { setTag(auth.user.playerTag); setError('') }}>Usar minha tag vinculada</button></div>}
      <button className={styles['submit-button']} type="submit" disabled={busy || (!linkingOnly && !invite.invite)} aria-busy={busy}>{busy ? <LoadingIndicator inline announce={false}>Confirmando tag…</LoadingIndicator> : linkingOnly ? 'Confirmar tag e finalizar' : 'Confirmar tag e entrar'}</button>
      {error && <p className={styles.message} role="alert">{error}</p>}
    </form>
    {invite.token && <InviteAccountOptions suffix={invite.suffix} disabled={busy} />}
    <p className={styles.footer}><Link to="/perfil">Ir para meu perfil</Link></p>
  </section></main>
}
export default JoinGroupPage
