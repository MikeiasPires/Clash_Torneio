import { Link } from 'react-router'
import Brand from '../../components/Brand/Brand.jsx'
import styles from './NotFoundPage.module.css'

function NotFoundPage() {
  return (
    <main className={styles.page}>
      <Brand variant="hero" />
      <p className={styles.code}>404</p>
      <h1>Essa arena não existe.</h1>
      <p>Confira o endereço ou volte para a tela de login.</p>
      <Link to="/login">Voltar ao login</Link>
    </main>
  )
}

export default NotFoundPage
