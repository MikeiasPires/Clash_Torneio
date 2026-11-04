export function cardImageUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'api-assets.clashroyale.com'
      && !url.port && !url.username && !url.password && url.pathname.startsWith('/cards/')
      ? url.href : null
  } catch { return null }
}

// Aceita tanto as cartas da API quanto as já salvas, sem expor campos extras.
export function normalizeBattleCards(cards) {
  if (!Array.isArray(cards)) return []
  const seen = new Set()
  return cards.slice(0, 8).flatMap(card => {
    if (!Number.isSafeInteger(card?.id) || card.id <= 0 || seen.has(card.id)) return []
    seen.add(card.id)
    return [{
      id: card.id,
      name: typeof card.name === 'string' && card.name.trim() ? card.name.trim().slice(0, 100) : 'Carta desconhecida',
      elixirCost: Number.isInteger(card.elixirCost) && card.elixirCost >= 0 && card.elixirCost <= 10 ? card.elixirCost : null,
      imageUrl: cardImageUrl(card.imageUrl ?? card.iconUrls?.medium),
    }]
  })
}
