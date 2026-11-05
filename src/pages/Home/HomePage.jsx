import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ranking as demoRanking } from '../Trophies/ranking.js'
import GroupPicker from '../../components/GroupPicker/GroupPicker.jsx'
import SessionLoading from '../../components/SessionLoading/SessionLoading.jsx'
import { useGroupDashboard } from '../../hooks/useGroupDashboard.js'
import { useAuth } from '../../auth/useAuth.js'
import HomeIcon from './HomeIcon.jsx'
import ChampionPhrase from './ChampionPhrase.jsx'
import styles from './HomePage.module.css'

function ChampionPortrait({ player }) {
  const [failedUrl, setFailedUrl] = useState(null)

  return (
    <div className={styles.portrait}>
      <div className={styles.avatar}>
        {player.avatarUrl && failedUrl !== player.avatarUrl ? (
          <img src={player.avatarUrl} alt={`Foto de perfil de ${player.name}`} onError={() => setFailedUrl(player.avatarUrl)} />
        ) : (
          <span role="img" aria-label={`Perfil de ${player.name}, sem foto`}>{player.name.charAt(0)}</span>
        )}
      </div>
      <span className={styles.crown}><HomeIcon name="crown" /></span>
      <span className={styles.position}>1º LUGAR</span>
    </div>
  )
}

function HomePage() {
  const [searchParams] = useSearchParams()
  const demo = searchParams.get('demo') === '1'
  const dashboard = useGroupDashboard({ autoSync: !demo })
  const { user } = useAuth()
  const ranking = demo ? demoRanking : dashboard.snapshot?.ranking || []
  const champion = ranking.find(player => player.matches > 0)
  const groupQuery = demo ? '?demo=1' : dashboard.groupId ? `?grupo=${encodeURIComponent(dashboard.groupId)}` : ''
  const initialLoading = !demo && dashboard.loading && !dashboard.snapshot && !dashboard.error

  if (initialLoading) return <SessionLoading>Preparando a arena…</SessionLoading>

  return (
    <section className={styles.page} aria-labelledby="home-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>SUA TURMA. SEUS DUELOS.</p>
        <h1 id="home-title">De olho <span>na coroa.</span></h1>
        <p className={styles.description}>Quem mais vence os x1 da turma.</p>
      </header>

      {!demo && <GroupPicker dashboard={dashboard} variant="home" />}

      {champion ? (
        <article className={styles.champion} aria-labelledby="champion-name">
          <div className={styles.championHeading}><p className={styles.championLabel}><HomeIcon name="trophy" />LÍDER DO GRUPO</p><span>Por vitórias nos x1</span></div>
          <ChampionPortrait key={`portrait:${champion.id}`} player={champion} />
          <h2 id="champion-name" className={styles.name}>{champion.name}</h2>
          <p className={styles.championCaption}>Cada x1 conta para seguir no topo.</p>
          <dl className={styles.stats} aria-label="Resultados do líder no grupo">
            <div><dt>Vitórias</dt><dd>{champion.wins.toLocaleString('pt-BR')}</dd></div>
            <div><dt>Partidas</dt><dd>{champion.matches.toLocaleString('pt-BR')}</dd></div>
            <div><dt>De vitórias</dt><dd>{Math.round(champion.wins / champion.matches * 100)}<span>%</span></dd></div>
          </dl>
          {demo ? <ChampionPhrase key={`phrase:${champion.id}`} player={champion} /> : <div className={styles.phraseSection}><p className={styles.phraseLabel}>PALAVRA DO CAMPEÃO</p><blockquote className={styles.phrase}>{champion.phrase || 'O campeão ainda não deixou sua frase.'}</blockquote></div>}
        </article>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><HomeIcon name="crown" /></span>
          <h2>{dashboard.error ? 'A arena não carregou' : 'A coroa espera um campeão'}</h2>
          <p>{dashboard.error ? 'Não foi possível carregar os registros. Tente novamente em instantes.' : dashboard.groups.length ? 'O primeiro x1 registrado vai revelar quem começa no topo do grupo.' : user?.isAdmin ? 'Crie seu grupo e convide a turma para começar a registrar os duelos.' : 'Abra o convite enviado pelo administrador para entrar no seu grupo.'}</p>
          {dashboard.error ? <button type="button" onClick={dashboard.refresh}>Tentar novamente <HomeIcon name="arrow" /></button> : <Link to="/grupos">{dashboard.groups.length ? 'Ver meu grupo' : user?.isAdmin ? 'Criar meu grupo' : 'Ver meus grupos'}<HomeIcon name="arrow" /></Link>}
        </div>
      )}

      <nav className={styles.shortcuts} aria-label="Explore os registros do grupo">
        <Link className={styles.shortcut} to={'/trofeus' + groupQuery}><span className={styles.shortcutIcon}><HomeIcon name="trophy" /></span><span><strong>Ranking da turma</strong><small>Veja quem está chegando ao topo</small></span><HomeIcon name="arrow" /></Link>
        <Link className={styles.shortcut} to={'/historico' + groupQuery}><span className={`${styles.shortcutIcon} ${styles.battlesIcon}`}><HomeIcon name="history" /></span><span><strong>Histórico de x1</strong><small>Cada duelo, cada vitória</small></span><HomeIcon name="arrow" /></Link>
      </nav>
      <p className={styles.notice}><HomeIcon name="shield" />{demo ? <span>Prévia com jogadores fictícios. <Link to="/home">Ver registros reais</Link></span> : <span>Apenas amistosos 1×1 registrados no grupo.</span>}</p>
    </section>
  )
}

export default HomePage
