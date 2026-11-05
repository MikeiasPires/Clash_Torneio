import styles from './LoadingIndicator.module.css'

function LoadingIndicator({ children = 'Carregando…', inline = false, fullscreen = false, announce = true }) {
  const compact = inline && !fullscreen
  return (
    <span className={`${styles.indicator} ${fullscreen ? styles.screen : compact ? styles.inline : styles.block}`}
      role={announce ? 'status' : undefined} aria-atomic={announce ? true : undefined}>
      <span className={styles.frame} aria-hidden="true">
        <img className={styles.helmet} src="/loading/helmet-96.webp"
          srcSet="/loading/helmet-48.webp 48w, /loading/helmet-96.webp 96w"
          sizes={compact ? '20px' : '36px'} width={compact ? 20 : 36} height={compact ? 20 : 36} alt="" />
      </span>
      <span className={styles.label}>{children}</span>
    </span>
  )
}

export default LoadingIndicator
