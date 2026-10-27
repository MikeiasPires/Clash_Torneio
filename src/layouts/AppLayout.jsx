import { Outlet } from 'react-router'
import BottomNavigation from '../components/BottomNavigation/BottomNavigation.jsx'
import styles from './AppLayout.module.css'

function AppLayout() {
  return (
    <div className={styles.layout}>
      <main className={styles.content} id="main-content">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}

export default AppLayout
