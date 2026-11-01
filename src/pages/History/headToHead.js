// Indexa o histórico uma vez, mantendo o placar na perspectiva de cada jogador.
export function buildHeadToHeadIndex(matches) {
  const index = new Map()
  const seenMatches = new Set()

  function recordResult(player, opponent) {
    if (!index.has(player.id)) index.set(player.id, new Map())
    const opponents = index.get(player.id)
    if (!opponents.has(opponent.id)) {
      opponents.set(opponent.id, { wins: 0, losses: 0, draws: 0, total: 0 })
    }

    const stats = opponents.get(opponent.id)
    stats.total += 1
    if (player.crowns > opponent.crowns) stats.wins += 1
    else if (player.crowns < opponent.crowns) stats.losses += 1
    else stats.draws += 1
  }

  for (const match of matches) {
    if (seenMatches.has(match.id)) continue
    seenMatches.add(match.id)
    recordResult(match.left, match.right)
    recordResult(match.right, match.left)
  }

  return index
}
