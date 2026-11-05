import styles from './Brand.module.css'

function Brand({ variant = 'compact', tagline = false }) {
  const hero = variant === 'hero'

  return (
    <div className={`${styles.brand} ${hero ? styles.hero : styles.compact}`}>
      <img
        className={styles.logo}
        src="/brand/logo-128.webp?v=2"
        srcSet="/brand/logo-64.webp?v=2 64w, /brand/logo-128.webp?v=2 128w, /brand/logo-256.webp?v=2 256w"
        sizes={hero ? '(max-width: 400px) 104px, 128px' : '48px'}
        width={hero ? 128 : 48}
        height={hero ? 128 : 48}
        alt=""
      />
      <span className={styles.name}>Clash <span>dos Amigui</span></span>
      {tagline && <p className={styles.tagline}>A resenha é nossa. A arena também.</p>}
    </div>
  )
}

export default Brand
