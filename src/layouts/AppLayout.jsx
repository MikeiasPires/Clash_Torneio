import { Link, Outlet } from 'react-router'
import Brand from '../components/Brand/Brand.jsx'
import BottomNavigation from '../components/BottomNavigation/BottomNavigation.jsx'
import styles from './AppLayout.module.css'

function AppLayout() {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link className={styles.brandLink} to="/home" aria-label="Clash dos Amigui — início"><Brand /></Link>
        <Link className={styles.profileLink} to="/perfil">Meu perfil <span aria-hidden="true">↗</span></Link>
      </header>
      <main className={styles.content} id="main-content">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}

export default AppLayout
