import { NavLink } from 'react-router'
import styles from './BottomNavigation.module.css'

const navigationItems = [
  { to: '/home', label: 'Home', icon: 'M3 6 8 10 12 4 16 10 21 6 19 18H5L3 6ZM6 22H18' },
  { to: '/trofeus', label: 'Troféus', icon: 'M7 3H17V8A5 5 0 0 1 7 8V3ZM7 5H3V8A4 4 0 0 0 7 12M17 5H21V8A4 4 0 0 1 17 12M12 13V21M7 21H17' },
  { to: '/historico', label: 'Histórico', icon: 'M14 3H5V21H19V8L14 3ZM14 3V8H19M9 12H15M9 16H15' },
  { to: '/perfil', label: 'Perfil', icon: 'M16 7A4 4 0 1 1 8 7 4 4 0 0 1 16 7ZM4 22V20A8 8 0 0 1 20 20V22' },
]

function BottomNavigation() {
  return (
    <nav className={styles.navigation} aria-label="Navegação principal">
      <ul className={styles.items}>
        {navigationItems.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) => `${styles.link}${isActive ? ` ${styles.active}` : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={icon} />
              </svg>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNavigation
