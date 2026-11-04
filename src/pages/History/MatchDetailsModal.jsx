import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import BattleDeck from './BattleDeck.jsx'
import styles from './MatchDetailsModal.module.css'

function MatchDetailsModal({ match, playerTag, onDismiss }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return createPortal(<dialog ref={dialog} className={styles.modal} aria-labelledby="match-details-title" aria-describedby="match-details-description"
    onCancel={event => { event.preventDefault(); onDismiss() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
    }}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>DUELO AMISTOSO · 1 × 1</p><h2 id="match-details-title">Cartas da batalha</h2>
        <p id="match-details-description" className={styles.description}>Os decks dos dois jogadores e o custo de elixir de cada carta.</p></div>
      <button type="button" className={styles.close} aria-label="Fechar cartas da batalha" onClick={onDismiss} autoFocus>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <div className={styles.body}>
      <div className={styles.decks}>
        <BattleDeck player={match.left} side="left" own={match.left.id === playerTag} />
        <BattleDeck player={match.right} side="right" own={match.right.id === playerTag} />
      </div>
      <p className={styles.note}><span aria-hidden="true">◆</span> O número roxo indica o custo de elixir. “?” indica custo não informado pela API.</p>
    </div>
  </dialog>, document.body)
}

export default MatchDetailsModal
