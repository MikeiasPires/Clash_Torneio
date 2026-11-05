import { Link } from 'react-router'
import LoadingIndicator from '../LoadingIndicator/LoadingIndicator.jsx'
import styles from './GroupPicker.module.css'

function GroupPicker({ dashboard, variant = 'default', showLoading = true }) {
  const { groups, groupId, selectGroup, error, loading } = dashboard
  return (
    <div className={[styles.picker, variant === 'home' && styles.home].filter(Boolean).join(' ')}>
      <label>{variant === 'home' ? 'GRUPO SELECIONADO' : 'Grupo de x1'}
        <select value={groupId} onChange={event => selectGroup(event.target.value)} disabled={!groups.length}>
          {!groups.length && <option value="">Nenhum grupo cadastrado</option>}
          {groups.map(group => <option key={group.id} value={group.id}>{group.name}{group.enabled ? '' : ' · pausado'}</option>)}
        </select>
      </label>
      <Link to="/grupos">{variant === 'home' ? 'Grupos' : 'Ver grupos'}</Link>
      {loading && showLoading && <p><LoadingIndicator inline>Carregando registros…</LoadingIndicator></p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default GroupPicker
