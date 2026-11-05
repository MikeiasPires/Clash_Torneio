import { useState } from 'react'
import { createGroupInvite, revokeGroupInvite } from '../../services/groupsApi.js'
import styles from './GroupsPage.module.css'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
function GroupInvite({ groupId, token, busy, pendingAction, execute, setMessage }) {
  const [invite, setInvite] = useState(null)
  return <section className={styles.memberForm} aria-labelledby="invite-heading">
    <h3 id="invite-heading" className={styles.sectionTitle}>Convidar jogadores</h3>
    <p>Compartilhe um link para a pessoa criar a conta, informar a tag e entrar no grupo. O convite vale por 7 dias. Gerar outro link invalida o anterior.</p>
    <div className={styles.actions}>
      <button type="button" disabled={busy} aria-busy={pendingAction === 'invite'} onClick={() => void execute(async signal => {
        const result = await createGroupInvite(groupId, token, signal)
        const url = new URL('/convite', window.location.origin); url.hash = result.token
        setInvite({ url: url.toString(), expiresAt: result.expiresAt })
        setMessage('Convite criado. Copie o link e envie para os jogadores.')
      }, 'invite')}>{pendingAction === 'invite' ? <LoadingIndicator inline announce={false}>Gerando convite…</LoadingIndicator> : 'Gerar link de convite'}</button>
      <button className={styles.secondary} type="button" disabled={busy} aria-busy={pendingAction === 'revoke-invite'} onClick={() => void execute(async signal => {
        await revokeGroupInvite(groupId, token, signal); setInvite(null); setMessage('Convite revogado. Quem já entrou continua no grupo.')
      }, 'revoke-invite')}>{pendingAction === 'revoke-invite' ? <LoadingIndicator inline announce={false}>Revogando…</LoadingIndicator> : 'Revogar convite'}</button>
    </div>
    {invite && <div className={styles.inviteLink}>
      <label htmlFor="group-invite-link">Link do grupo</label><input id="group-invite-link" value={invite.url} readOnly onFocus={event => event.currentTarget.select()} />
      <p>Válido até {new Date(invite.expiresAt).toLocaleString('pt-BR')}.</p>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(invite.url); setMessage('Link copiado.') }
        catch { setMessage('Selecione e copie o link no campo acima.') }
      }}>Copiar link</button>
    </div>}
  </section>
}
export default GroupInvite
