import { useState } from 'react'
import { Link } from 'react-router'
import { addGroupMembers, deleteGroup, removeGroupMember, syncGroup, toggleGroup } from '../../services/groupsApi.js'
import { parseGroupTags } from '../../../shared/playerTag.js'
import styles from './GroupsPage.module.css'
import GroupInvite from './GroupInvite.jsx'

function GroupManagement({ snapshot, token, canManage, busy, execute, setMessage, onDeleted }) {
  const [newTags, setNewTags] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const { group, members, totalMatches } = snapshot
  const disabled = busy || !canManage

  function addMembers(event) {
    event.preventDefault()
    void execute(async signal => {
      const result = await addGroupMembers(group.id, parseGroupTags(newTags), token, signal)
      setNewTags('')
      setMessage(`${result.added} jogador(es) adicionado(s). O monitor vai consultar os novos membros.`)
    })
  }

  function confirmRemoval() {
    const action = confirmation
    void execute(async signal => {
      if (action.type === 'group') {
        await deleteGroup(group.id, token, signal)
        setMessage(`O grupo ${group.name} foi excluído.`)
        onDeleted(group.id)
      } else {
        await removeGroupMember(group.id, action.member.tag, token, signal)
        setMessage(`${action.member.name} foi retirado do grupo. O histórico foi preservado para uma eventual volta.`)
      }
      setConfirmation(null)
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.groupHeading}><h2>{group.name}</h2><span>{!group.enabled ? 'Consultas pausadas' : members.length < 2 ? 'Aguardando 2 jogadores' : 'Monitoramento ativo'}</span></div>
      <p>{members.length} jogadores · {totalMatches} amistosos nos placares atuais</p>
      <div className={styles.actions}>
        {canManage && <><button type="button" disabled={disabled || !group.enabled || members.length < 2} onClick={() => void execute(async signal => {
          const report = await syncGroup(group.id, token, signal)
          setMessage(report.checkedPlayers ? `${report.checkedPlayers} jogadores consultados; ${report.recordedMatches} novos registros nos grupos.${report.failures.length ? ` ${report.failures.length} consultas falharam; os outros resultados foram salvos.` : ''}` : 'Os jogadores já foram consultados recentemente. O monitor retomará as consultas automaticamente.')
        })}>Consultar agora</button>
        <button className={styles.secondary} type="button" disabled={disabled} onClick={() => void execute(async signal => {
          await toggleGroup(group.id, !group.enabled, token, signal)
          setMessage(group.enabled ? 'Consultas do grupo pausadas. Os registros foram preservados.' : 'Monitoramento retomado.')
        })}>{group.enabled ? 'Pausar consultas' : 'Retomar consultas'}</button></>}
        <Link to={`/historico?grupo=${group.id}`}>Ver partidas e confrontos →</Link>
      </div>

      <h3 className={styles.sectionTitle}>Jogadores do grupo</h3>
      {!members.length && <p>O grupo está sem jogadores. Adicione pelo menos dois para retomar as consultas.</p>}
      <ul className={styles.members}>{members.map(member => <li key={member.tag}>
        <div>{member.avatarUrl && <img className={styles.memberPhoto} src={member.avatarUrl} alt="" />}<strong>{member.name}</strong><span>{member.tag}</span></div>
        <p>{member.lastError || (member.lastSuccessAt ? `Última consulta: ${new Date(member.lastSuccessAt).toLocaleString('pt-BR')}` : 'Aguardando primeira consulta')}</p>
        {canManage && <button className={styles.removeMember} type="button" disabled={disabled} aria-label={`Remover ${member.name}, ${member.tag}, do grupo`} onClick={() => setConfirmation({ type: 'member', member })}>Retirar do grupo</button>}
      </li>)}</ul>

      {canManage && <><GroupInvite groupId={group.id} token={token} busy={busy} execute={execute} setMessage={setMessage} />
      <form className={styles.memberForm} onSubmit={addMembers}>
        <h3 className={styles.sectionTitle}>Adicionar jogadores</h3>
        <label htmlFor="additional-tags">Tags dos novos membros</label>
        <textarea id="additional-tags" value={newTags} onChange={event => setNewTags(event.target.value)} maxLength={2000} rows={3} placeholder={'#P0LY Nome do amigo\n#QY82 Outro amigo'} disabled={disabled || members.length >= 20} required />
        <p>Uma tag com nome por linha, ou várias tags separadas por espaço ou vírgula. Limite de 20 jogadores no grupo.</p>
        <button type="submit" disabled={disabled || !newTags.trim() || members.length >= 20}>Adicionar ao grupo</button>
      </form>

      <div className={styles.deleteSection}>
        <h3 className={styles.sectionTitle}>Excluir grupo</h3>
        <p>Remove o grupo inteiro e seus registros. Partidas compartilhadas com outros grupos permanecem nesses grupos.</p>
        <button className={styles.danger} type="button" disabled={disabled} onClick={() => setConfirmation({ type: 'group' })}>Excluir grupo por completo</button>
      </div></>}

      {confirmation && <section className={styles.confirmation} aria-label={confirmation.type === 'group' ? 'Confirmar exclusão do grupo' : 'Confirmar retirada do jogador'}>
        <h3>{confirmation.type === 'group' ? `Excluir ${group.name}?` : `Retirar ${confirmation.member.name} do grupo?`}</h3>
        <p>{confirmation.type === 'group' ? 'Esta ação exclui o grupo e seus vínculos com as partidas, incluindo o histórico arquivado. A exclusão não pode ser desfeita.' : 'O jogador deixa de ser monitorado por este grupo e seus confrontos saem dos placares atuais. O histórico fica arquivado para uma eventual volta.'}</p>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => setConfirmation(null)} autoFocus>Cancelar</button>
          <button className={styles.danger} type="button" disabled={disabled} onClick={confirmRemoval}>{confirmation.type === 'group' ? 'Sim, excluir definitivamente' : 'Sim, retirar jogador'}</button>
        </div>
      </section>}
    </div>
  )
}

export default GroupManagement
