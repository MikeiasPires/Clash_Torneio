import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth.js'
import PhotoField from '../../components/PhotoField/PhotoField.jsx'
import LoadingIndicator from '../../components/LoadingIndicator/LoadingIndicator.jsx'
import ProfileIcon from './ProfileIcon.jsx'
import { promoteAccount, updateAccount } from '../../services/accountApi.js'
import styles from './ProfilePage.module.css'

function ProfileSettingsModal({ user, onDismiss, onSaved }) {
  const auth = useAuth()
  const dialog = useRef(null)
  const [name, setName] = useState(user.name)
  const [age, setAge] = useState(user.age)
  const [phrase, setPhrase] = useState(user.phrase || '')
  const [photo, setPhoto] = useState(null)
  const [organizerCode, setOrganizerCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!element.open) element.showModal()
    return () => { element.close(); document.body.style.overflow = previousOverflow }
  }, [])

  async function run(action, message, operation = 'save') {
    setBusy(operation); setError('')
    try {
      const result = await action()
      auth.acceptUser(result.user)
      onSaved(message)
    } catch (error) { setError(error.message) }
    finally { setBusy('') }
  }

  return <dialog ref={dialog} className={styles.modal} aria-labelledby="profile-settings-title" aria-describedby="profile-settings-description"
    onCancel={event => { event.preventDefault(); if (!busy) onDismiss() }}
    onClose={() => { if (!dialog.current?.open) onDismiss() }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
    }}>
    <header className={styles.modalHeader}>
      <div><span className={styles.modalEyebrow}>DO SEU JEITO</span><h2 id="profile-settings-title" tabIndex={-1} autoFocus>Editar perfil</h2><p id="profile-settings-description" className={styles.help}>Seu nome, sua foto, sua identidade.</p></div>
      <button className={styles.close} type="button" aria-label="Fechar configurações do perfil" disabled={busy} onClick={onDismiss}><ProfileIcon name="close" /></button>
    </header>
    <div className={styles.modalBody}>
    <form id="profile-settings-form" className={styles.settingsForm} onSubmit={event => {
      event.preventDefault()
      void run(() => updateAccount({ name, age: Number(age), phrase, photo }), 'Perfil atualizado.')
    }}>
      <PhotoField value={photo} current={user.avatarUrl} onChange={setPhoto} onError={setError} disabled={busy} largePreview />
      <div className={styles.formRow}>
        <div className={styles.field}><label htmlFor="profile-name">Nome no perfil</label><input id="profile-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="name" aria-describedby="profile-name-help" disabled={busy} required /><p id="profile-name-help" className={styles.help}>Visível apenas no seu perfil. Na arena, usamos seu nick do Clash Royale.</p></div>
        <div className={styles.field}><label htmlFor="profile-age">Idade</label><input id="profile-age" type="number" inputMode="numeric" min={1} max={120} step={1} value={age} onChange={event => setAge(event.target.value)} disabled={busy} required /></div>
      </div>
      <div className={styles.field}><div className={styles.fieldHeading}><label htmlFor="profile-phrase">Sua frase</label><span>{phrase.length}/160</span></div><textarea id="profile-phrase" value={phrase} onChange={event => setPhrase(event.target.value)} maxLength={160} rows={3} disabled={busy} placeholder="Qual é o seu recado para a turma?" /><p className={styles.help}>Aparece na home quando você liderar o grupo.</p></div>
    </form>
    {!user.isAdmin && <details className={styles.organizer}><summary>Sou o organizador do aplicativo</summary>
      <form className={styles.promote} onSubmit={event => {
        event.preventDefault()
        void run(() => promoteAccount(organizerCode), 'Acesso de administrador ativado.', 'promote')
      }}>
        <label htmlFor="organizer-code">Código privado do organizador</label><input id="organizer-code" type="password" value={organizerCode} onChange={event => setOrganizerCode(event.target.value)} autoComplete="off" disabled={busy} required />
        <button type="submit" disabled={Boolean(busy)} aria-busy={busy === 'promote'}>{busy === 'promote' ? <LoadingIndicator inline announce={false}>Ativando…</LoadingIndicator> : 'Ativar acesso de administrador'}</button>
      </form>
    </details>}
    </div>
    <footer className={styles.modalFooter}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.modalActions}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={onDismiss}>Cancelar</button>
        <button className={styles.saveButton} type="submit" form="profile-settings-form" disabled={Boolean(busy)} aria-busy={busy === 'save'}>{busy === 'save' ? <LoadingIndicator inline announce={false}>Salvando…</LoadingIndicator> : 'Salvar alterações'}</button>
      </div>
    </footer>
  </dialog>
}
export default ProfileSettingsModal
