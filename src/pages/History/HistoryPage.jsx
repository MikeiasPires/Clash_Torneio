import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import GroupPicker from '../../components/GroupPicker/GroupPicker.jsx'
import { useGroupDashboard } from '../../hooks/useGroupDashboard.js'
import MatchCard from './MatchCard.jsx'
import { matches as demoMatches } from './matches.js'
import { buildHeadToHeadIndex } from './headToHead.js'
import styles from './HistoryPage.module.css'

const demoIndex = buildHeadToHeadIndex(demoMatches)

function HistoryPage() {
  const [searchParams] = useSearchParams()
  const demo = searchParams.get('demo') === '1'
  const dashboard = useGroupDashboard({ autoSync: !demo })
  const snapshot = dashboard.snapshot
  const matches = demo ? demoMatches : snapshot?.matches || []
  const index = useMemo(() => {
    if (demo) return demoIndex
    const result = new Map()
    for (const row of snapshot?.headToHead || []) {
      if (!result.has(row.playerTag)) result.set(row.playerTag, new Map())
      result.get(row.playerTag).set(row.opponentTag, row)
    }
    return result
  }, [demo, snapshot])

  return (
    <section className={styles.page} aria-labelledby="history-title">
      <header className={styles.header}>
        <span className={styles.emblem} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 3 7 6-2 3-6-7 1-2Zm16 0-7 6 2 3 6-7-1-2ZM7 14l3 3M4 20l5-5m8-1-3 3m6 3-5-5M3 17l4 4m14-4-4 4" />
          </svg>
        </span>
        <p className={styles.eyebrow}>CADA X1 FICA REGISTRADO</p>
        <h1 id="history-title">Histórico de batalhas</h1>
        <p className={styles.description}>Partidas salvas entre os amigos. O placar continua mesmo depois de fechar o aplicativo.</p>
      </header>

      {!demo && <GroupPicker dashboard={dashboard} />}
      <div className={styles.listHeading}>
        <h2>{demo ? 'Demonstração' : snapshot?.group.name || 'X1 registrados'}</h2>
        <span>{demo ? demoMatches.length : snapshot?.totalMatches || 0} partidas</span>
      </div>
      {matches.length ? (
        <ol className={styles.matches} aria-label="Partidas da mais recente para a mais antiga">
          {matches.map(match => <MatchCard key={match.id} match={match}
            headToHead={index.get(match.left.id).get(match.right.id)}
            headToHeadNote={demo ? 'Contagem fictícia para demonstração.' : undefined} />)}
        </ol>
      ) : !dashboard.loading && (
        <p className={styles.empty}>{dashboard.groups.length ? 'Nenhum x1 registrado entre os membros deste grupo. O monitor vai procurar novos amistosos.' : <>Crie um grupo com as tags dos amigos para começar. <Link to="/grupos">Cadastrar grupo</Link></>}</p>
      )}
      {!demo && snapshot && <div className={styles.pagination}>
        <button type="button" onClick={dashboard.previousPage} disabled={dashboard.offset === 0 || dashboard.loading}>Mais recentes</button>
        <span>{snapshot.totalMatches ? dashboard.offset + 1 : 0}–{Math.min(dashboard.offset + matches.length, snapshot.totalMatches)} de {snapshot.totalMatches}</span>
        <button type="button" onClick={dashboard.nextPage} disabled={dashboard.offset + matches.length >= snapshot.totalMatches || dashboard.loading}>Mais antigas</button>
      </div>}
      <p className={styles.notice}>{demo ? <>Dados fictícios: Mestre do Deck 5 × 1 Rei da Arena. <Link to="/historico">Voltar aos registros reais</Link></> : <>Retrospecto acumulado de todas as partidas salvas neste grupo. <Link to="/historico?demo=1">Ver demonstração</Link></>}</p>
    </section>
  )
}

export default HistoryPage
