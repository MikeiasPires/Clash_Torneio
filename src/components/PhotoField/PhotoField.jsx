import { useId, useRef } from 'react'
import styles from './PhotoField.module.css'
function PhotoField({ value, current, name = 'Foto de perfil', onChange, onError, disabled = false, largePreview = false }) {
  const input = useRef(null)
  const id = useId()
  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      onError('Escolha uma foto JPEG, PNG ou WebP de até 2 MB.'); event.target.value = ''; return
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
        reader.readAsDataURL(file)
      })
      onChange(data); onError('')
    } catch (error) { onError(error.message) }
  }
  return <div className={[styles.field, largePreview && styles.largePreview].filter(Boolean).join(' ')}>
    <p id={id + '-title'} className={styles.title}>{name} <span>Opcional</span></p>
    <div className={styles.photoRow}>
      <div className={styles.preview}>{(value || current) ? <img src={value || current} alt="Prévia da sua foto de perfil" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></svg>}</div>
      <div className={styles.uploadContent}>
        <label className={styles.upload}>
          <input ref={input} className={styles.fileInput} type="file" aria-labelledby={id + '-title ' + id + '-action'} accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={disabled} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h3l2-3h6l2 3h3a1 1 0 0 1 1 1v13H3V7a1 1 0 0 1 1-1Z" /><circle cx="12" cy="12" r="4" /></svg><span id={id + '-action'}>{value || current ? 'Trocar foto' : 'Escolher foto'}</span>
        </label>
        <small>JPG, PNG ou WebP · Até 2 MB</small>
        {value && <button className={styles.undo} type="button" disabled={disabled} onClick={() => { onChange(null); if (input.current) input.current.value = '' }}>Desfazer escolha</button>}
      </div>
    </div>
  </div>
}
export default PhotoField
