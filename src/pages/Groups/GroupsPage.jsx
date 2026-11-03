import { useEffect, useRef, useState } from 'react'
import GroupPicker from '../../components/GroupPicker/GroupPicker.jsx'
import { useGroupDashboard } from '../../hooks/useGroupDashboard.js'
import { createGroup } from '../../services/groupsApi.js'
import { parseGroupTags } from '../../../shared/playerTag.js'
import GroupManagement from './GroupManagement.jsx'
import { useAuth } from '../../auth/useAuth.js'
import styles from './GroupsPage.module.css'

function GroupsPage() {
  const dashboard = useGroupDashboard()
  const { user } = useAuth()
  const manager = Boolean(user?.isAdmin)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef(null)
  const snapshot = dashboard.snapshot
  useEffect(() => () => request.current?.abort(), [])

  async function execute(action) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setMessage(''); setError('')
    try { await action(controller.signal) }
    catch (error) { if (!controller.signal.aborted) setError(error.message) }
    finally { if (!controller.signal.aborted) { setBusy(false); dashboard.refresh() } }
  }

  function submitGroup(event) {
    event.preventDefault()
    void execute(async signal => {
      const result = await createGroup({ name, tags: parseGroupTags(tags) }, undefined, signal)
      dashboard.selectGroup(result.group.id)
      setName(''); setTags('')
      setMessage('Grupo criado. O monitor vai consultar os jogadores e registrar os x1 encontrados.')
    })
  }

  return (
    <section className={styles.page} aria-labelledby="groups-title">
      <header className={styles.header}>
        <p>REGISTRADOR DE X1</p>
        <h1 id="groups-title">Sua turma. Cada duelo contado.</h1>
        <span>Reúna as tags dos amigos. O app registra os amistosos 1 × 1 entre os membros e acumula o placar.</span>
      </header>
      {!manager && <p className={styles.notice}>Aqui aparecem os grupos em que você entrou. Para participar de outro, abra um convite enviado pelo administrador.</p>}
      {manager && <form className={styles.card} onSubmit={submitGroup}>
        <h2>Criar grupo</h2>
        <label htmlFor="group-name">Nome do grupo</label>
        <input id="group-name" value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder="Os Amigui da Arena" disabled={busy} required />
        <label htmlFor="group-tags">Tags dos jogadores (opcional)</label>
        <textarea id="group-tags" value={tags} onChange={event => setTags(event.target.value)} rows={3} maxLength={2000} placeholder={'Deixe vazio para preencher o grupo por convites.\nOu cole #TAG Nome do amigo, uma pessoa por linha.'} aria-describedby="tags-help" spellCheck={false} disabled={busy} />
        <p id="tags-help">Você pode criar o grupo só com o nome e gerar um convite. Se quiser adicionar jogadores agora, informe até 20 tags. As consultas começam com pelo menos dois membros.</p>
        <button type="submit" disabled={busy}>{busy ? 'Processando…' : 'Criar grupo'}</button>
      </form>}
      <p className={styles.message} role="status">{message}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <GroupPicker dashboard={dashboard} />
      {snapshot && <GroupManagement key={snapshot.group.id} snapshot={snapshot}
        canManage={manager} busy={busy || dashboard.loading}
        execute={execute} setMessage={setMessage} onDeleted={dashboard.forgetGroup} />}
      <p className={styles.notice}>Com o grupo ativo, as partidas são consultadas automaticamente a cada 30 segundos enquanto alguém acompanha o grupo no aplicativo. Cada lote consulta até 8 jogadores. Partidas antigas fora da API não podem ser recuperadas.</p>
    </section>
  )
}

export default GroupsPage
