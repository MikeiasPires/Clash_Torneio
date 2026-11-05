import styles from './LoadingIndicator.module.css'

function LoadingIndicator({ children = 'Carregando…', inline = false, announce = true }) {
  return (
    <span className={`${styles.indicator} ${inline ? styles.inline : styles.block}`}
      role={announce ? 'status' : undefined} aria-atomic={announce ? true : undefined}>
      <span className={styles.frame} aria-hidden="true">
        <img className={styles.helmet} src="/loading/helmet-96.webp"
          srcSet="/loading/helmet-48.webp 48w, /loading/helmet-96.webp 96w"
          sizes={inline ? '20px' : '36px'} width={inline ? 20 : 36} height={inline ? 20 : 36} alt="" />
      </span>
      <span>{children}</span>
    </span>
  )
}

export default LoadingIndicator
