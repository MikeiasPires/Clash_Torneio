import styles from './HistoryPage.module.css'

function PlayerStats({ name, wins, losses }) {
  return (
    <div className={styles.rivalPlayer}>
      <h4>{name}</h4>
      <dl className={styles.rivalNumbers}>
        <div><dt>Vitórias</dt><dd className={styles.rivalWins}>{wins}</dd></div>
        <div><dt>Derrotas</dt><dd className={styles.rivalLosses}>{losses}</dd></div>
      </dl>
    </div>
  )
}

function HeadToHead({ left, right, stats, note = 'Placar acumulado de todos os amistosos registrados neste grupo.' }) {
  const { wins, losses, draws, total } = stats

  return (
    <details className={styles.headToHead}>
      <summary className={styles.rivalToggle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20V13M10 20V9M16 20V4M3 20H21" />
        </svg>
        <span>Ver confronto direto<span className={styles.srOnly}> entre {left.name} e {right.name}</span></span>
        <svg className={styles.rivalChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <section className={styles.rivalPanel} aria-label={`Placar entre ${left.name} e ${right.name}`}>
        <p className={styles.rivalEyebrow}>A RIVALIDADE EM NÚMEROS</p>
        <p className={styles.rivalTotal}>{total} {total === 1 ? 'amistoso registrado' : 'amistosos registrados'}</p>
        <div className={styles.rivalPlayers}>
          <PlayerStats name={left.name} wins={wins} losses={losses} />
          <span className={styles.rivalVersus} aria-hidden="true">×</span>
          <PlayerStats name={right.name} wins={losses} losses={wins} />
        </div>
        <p className={styles.rivalDraws}>{draws} {draws === 1 ? 'empate' : 'empates'}</p>
        <p className={styles.rivalNote}>{note}</p>
      </section>
    </details>
  )
}

export default HeadToHead
