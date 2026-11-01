import { useState } from 'react'
import styles from './HomePage.module.css'

const MAX_PHRASE_LENGTH = 160

function ChampionPhrase({ player }) {
  const storageKey = `clashdosamigui:champion-phrase:${player.id}`
  const [phrase, setPhrase] = useState(() => {
    try {
      return (localStorage.getItem(storageKey) || player.phrase || '').slice(0, MAX_PHRASE_LENGTH)
    } catch {
      return (player.phrase || '').slice(0, MAX_PHRASE_LENGTH)
    }
  })
  const [draft, setDraft] = useState(phrase)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  function savePhrase(event) {
    event.preventDefault()
    const nextPhrase = draft.trim().slice(0, MAX_PHRASE_LENGTH)
    if (!nextPhrase) return

    setPhrase(nextPhrase)
    setEditing(false)
    try {
      localStorage.setItem(storageKey, nextPhrase)
      setMessage('Frase salva neste navegador.')
    } catch {
      setMessage('Frase atualizada. O navegador não permitiu salvá-la para a próxima visita.')
    }
  }

  return (
    <div className={styles.phraseSection}>
      <p className={styles.phraseLabel}>PALAVRA DO CAMPEÃO</p>
      <blockquote className={styles.phrase}>
        {phrase || 'O campeão ainda não deixou sua frase.'}
      </blockquote>
      {editing ? (
        <form className={styles.editor} onSubmit={savePhrase}>
          <label htmlFor="champion-phrase">Frase do jogador</label>
          <textarea
            id="champion-phrase"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_PHRASE_LENGTH}
            aria-describedby="phrase-limit"
            rows={3}
            required
          />
          <span id="phrase-limit" className={styles.counter}>{draft.length}/{MAX_PHRASE_LENGTH} caracteres</span>
          <div className={styles.actions}>
            <button type="submit" disabled={!draft.trim()}>Salvar frase</button>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className={styles.editButton} type="button" onClick={() => {
          setDraft(phrase)
          setMessage('')
          setEditing(true)
        }}>Editar frase de exemplo</button>
      )}
      <p className={styles.status} role="status">{message}</p>
    </div>
  )
}

export default ChampionPhrase
