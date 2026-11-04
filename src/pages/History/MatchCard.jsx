import HeadToHead from './HeadToHead.jsx'
import styles from './HistoryPage.module.css'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

function Crown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m3 5 5 4 4-6 4 6 5-4-2 13H5L3 5Zm3 15h12v2H6v-2Z" />
    </svg>
  )
}

function PlayerResult({ player, winner, draw, side }) {
  return (
    <div className={`${styles.player} ${styles[side]} ${winner ? styles.winner : ''}`}>
      <div className={styles.portrait} aria-hidden="true">
        {winner && <Crown className={styles.championCrown} />}
        <div className={styles.avatar}>
          <span className={styles.avatarInitial}>{player.name.charAt(0)}</span>
          <svg className={styles.crest} viewBox="0 0 80 90" fill="none">
            <path d="M6 7 40 2 74 7v39c0 19-18 33-34 41C24 79 6 65 6 46V7Z" stroke="currentColor" strokeWidth="3" />
            <path d="m14 14 26-4 26 4v31c0 13-12 25-26 33-14-8-26-20-26-33V14Z" stroke="currentColor" strokeOpacity=".3" />
          </svg>
        </div>
      </div>
      <h3>{player.name}</h3>
      <div className={styles.crowns} aria-label={`${player.crowns} coroas conquistadas`}>
        {[0, 1, 2].map((index) => (
          <Crown key={index} className={index < player.crowns ? styles.earnedCrown : styles.emptyCrown} />
        ))}
      </div>
      <span className={winner ? styles.winnerBadge : styles.resultBadge}>
        {winner && <Crown className={styles.badgeCrown} />}
        {draw ? 'Empate' : winner ? 'Vencedor' : 'Derrota'}
      </span>
    </div>
  )
}

function MatchCard({ match, headToHead, headToHeadNote, onViewDetails }) {
  const { left, right, playedAt } = match
  const draw = left.crowns === right.crowns
  const winner = draw ? null : left.crowns > right.crowns ? left : right

  return (
    <li className={`${styles.matchCard} ${draw ? styles.drawCard : ''}`}>
      <div className={styles.matchSummary}>
      <div className={styles.matchHeading}>
        <span className={styles.mode}>DUELO AMISTOSO <span>1 × 1</span></span>
        <time dateTime={playedAt}>{dateFormatter.format(new Date(playedAt))}</time>
      </div>
      <div className={styles.arena}>
        <PlayerResult player={left} winner={winner?.id === left.id} draw={draw} side="left" />
        <div className={styles.scoreboard}>
          <div className={styles.duelEmblem} aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 5 13 12-4 4L5 8l3-3Zm24 0L19 17l4 4L35 8l-3-3ZM11 24l5 5M7 33l7-7m15-2-5 5m9 4-7-7M5 29l6 6m24-6-6 6" />
            </svg>
          </div>
          <span className={styles.scoreLabel}>COROAS</span>
          <p className={styles.score} aria-label={`${left.name}: ${left.crowns} coroas. ${right.name}: ${right.crowns} coroas.`}>
            <span className={winner?.id === left.id ? styles.winningScore : ''}>{left.crowns}</span>
            <span className={styles.scoreDivider} aria-hidden="true">:</span>
            <span className={winner?.id === right.id ? styles.winningScore : ''}>{right.crowns}</span>
          </p>
          <span className={styles.finished}><span aria-hidden="true" />Finalizada</span>
        </div>
        <PlayerResult player={right} winner={winner?.id === right.id} draw={draw} side="right" />
      </div>
      <div className={styles.matchFooter}>
        <span className={styles.footerLabel}>{draw ? 'DUELO EQUILIBRADO' : 'A COROA TEM DONO'}</span>
        <span className={styles.footerResult}>
          {draw ? 'Essa merece uma revanche.' : <><Crown className={styles.badgeCrown} />{winner.name}</>}
        </span>
      </div>
      <button type="button" className={styles.detailsButton} aria-haspopup="dialog"
        aria-label={`Ver cartas da batalha: ${left.name} contra ${right.name}`} onClick={onViewDetails}>
        Ver cartas da batalha <span aria-hidden="true">→</span>
      </button>
      </div>
      {headToHead && <HeadToHead left={left} right={right} stats={headToHead} note={headToHeadNote} />}
    </li>
  )
}

export default MatchCard
