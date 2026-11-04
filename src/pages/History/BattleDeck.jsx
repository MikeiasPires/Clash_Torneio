import { useState } from 'react'
import { normalizeBattleCards } from '../../../shared/battleCards.js'
import styles from './MatchDetailsModal.module.css'

function BattleCard({ card }) {
  const [failed, setFailed] = useState(false)
  return <li className={styles.card}>
    <div className={styles.cardArt}>
      {card.imageUrl && !failed
        ? <img src={card.imageUrl} alt={card.name} width="120" height="144" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span className={styles.missingArt} role="img" aria-label={`Imagem indisponível: ${card.name}`}>?</span>}
      <span className={styles.elixir} aria-label={card.elixirCost === null ? 'Custo de elixir não informado' : `${card.elixirCost} de elixir`}>
        {card.elixirCost ?? '?'}
      </span>
    </div>
    <span className={styles.cardName}>{card.name}</span>
  </li>
}

function BattleDeck({ player, side, own }) {
  const cards = normalizeBattleCards(player.cards)
  return <section className={`${styles.deck} ${styles[side]}`} aria-label={`Deck de ${player.name}`}>
    <header className={styles.deckHeader}>
      <div><p>{own ? 'SEU DECK' : 'DECK NA BATALHA'}</p><h3>{player.name}</h3></div>
      <span className={styles.crowns}>{player.crowns} <span>coroas</span></span>
    </header>
    {cards.length ? <ul className={styles.cards}>{cards.map(card => <BattleCard key={card.id} card={card} />)}</ul>
      : <p className={styles.emptyDeck}>As cartas não foram registradas nesta partida.</p>}
  </section>
}

export default BattleDeck
