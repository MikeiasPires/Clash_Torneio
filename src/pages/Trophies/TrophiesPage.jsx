import { Link, useSearchParams } from 'react-router'
import { ranking as demoRanking } from './ranking.js'
import GroupPicker from '../../components/GroupPicker/GroupPicker.jsx'
import { useGroupDashboard } from '../../hooks/useGroupDashboard.js'
import winnerLaurel from '../../assets/winner-laurel.png'
import greenLaurel from '../../assets/green-laurel.png'
import styles from './TrophiesPage.module.css'

const podiumStyles = [styles.gold, styles.silver, styles.bronze]
const podiumLabels = ['Campeão da arena', 'Vice-campeão', 'Terceiro lugar']

function TrophiesPage() {
  const [searchParams] = useSearchParams()
  const demo = searchParams.get('demo') === '1'
  const dashboard = useGroupDashboard({ autoSync: !demo })
  const ranking = (demo ? demoRanking : dashboard.snapshot?.ranking || []).slice(0, 10)
  return (
    <section className={styles.page} aria-labelledby="ranking-title">
      <header className={styles.header}>
        <span className={styles.emblem} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3H17V8A5 5 0 0 1 7 8V3ZM7 5H3V8A4 4 0 0 0 7 12M17 5H21V8A4 4 0 0 1 17 12M12 13V21M7 21H17" />
          </svg>
        </span>
        <p className={styles.eyebrow}>OS MELHORES DA ARENA</p>
        <h1 id="ranking-title">Ranking dos Amigui</h1>
        <p className={styles.description}>Cada vitória te deixa mais perto do topo.</p>
      </header>

      {!demo && <GroupPicker dashboard={dashboard} />}

      <div className={styles.listHeading}>
        <h2>Top 10 jogadores</h2>
        <span>Por vitórias nos x1</span>
      </div>
      <ol className={styles.ranking} aria-label="Classificação dos jogadores">
        {ranking.map((player, index) => (
          <li key={player.id} className={`${styles.player} ${podiumStyles[index] || ''}`}>
            <span className={styles.position} aria-label={`${index + 1}º lugar`}>{index + 1}</span>
            {index < 3 && (
              <div className={styles.portrait}>
                <div className={styles.avatar} aria-hidden="true">
                  {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : player.name.charAt(0)}
                </div>
                <img className={styles.laurel} src={index === 0 ? winnerLaurel : greenLaurel} alt="" width="64" height="64" />
              </div>
            )}
            <div className={styles.identity}>
              {index < 3 && player.matches > 0 && <span className={styles.podiumLabel}>{podiumLabels[index]}</span>}
              <h3>{player.name}</h3>
              <p>{player.matches} partidas <span aria-hidden="true">·</span> {player.matches ? Math.round(player.wins / player.matches * 100) : 0}% de vitórias</p>
            </div>
            <div className={styles.wins}>
              <strong>{player.wins}</strong>
              <span>vitórias</span>
            </div>
          </li>
        ))}
      </ol>
      {!ranking.length && !dashboard.loading && <p className={styles.notice}>Cadastre um grupo para acompanhar o ranking dos x1.</p>}
      <p className={styles.notice}>{demo ? <>Prévia com jogadores fictícios. <Link to="/trofeus">Voltar aos registros reais</Link></> : 'O total considera apenas partidas registradas entre os membros do grupo.'}</p>
    </section>
  )
}

export default TrophiesPage
