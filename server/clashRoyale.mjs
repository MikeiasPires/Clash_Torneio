import { createHash } from 'node:crypto'
import process from 'node:process'
import { normalizePlayerTag } from '../shared/playerTag.js'
import { normalizeBattleCards } from '../shared/battleCards.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const apiUrls = {
  direct: 'https://api.clashroyale.com/v1',
  royaleapi: 'https://proxy.royaleapi.dev/v1',
}

function battleDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second, millisecond] = match
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}Z`
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) && date.toISOString() === iso ? iso : null
}

function battlePlayer(player) {
  if (!player || !Number.isInteger(player.crowns) || player.crowns < 0 || player.crowns > 3) return null
  try {
    const tag = normalizePlayerTag(player.tag)
    return { id: tag, name: typeof player.name === 'string' ? player.name.slice(0, 100) : tag,
      crowns: player.crowns, cards: normalizeBattleCards(player.cards) }
  } catch {
    return null
  }
}

export function normalizeFriendlyBattles(battles, playerTag) {
  if (!Array.isArray(battles)) throw new ApiError(502, 'A API retornou um histórico inválido.')
  const matches = new Map()
  for (const battle of battles) {
    if (battle?.type !== 'friendly' || battle.team?.length !== 1 || battle.opponent?.length !== 1) continue
    const team = battlePlayer(battle.team[0])
    const opponent = battlePlayer(battle.opponent[0])
    const playedAt = battleDate(battle.battleTime)
    if (!team || !opponent || !playedAt || team.id === opponent.id) continue
    const left = team.id === playerTag ? team : opponent.id === playerTag ? opponent : null
    if (!left) continue
    const right = left === team ? opponent : team
    // A API não fornece um ID de partida: a chave permanece igual ao consultar qualquer lado.
    const identity = [playedAt, ...[left.id, right.id].sort(), battle.gameMode?.id ?? null]
    const id = createHash('sha256').update(JSON.stringify(identity)).digest('hex')
    matches.set(id, { id, playedAt, left, right })
  }
  return [...matches.values()].sort((a, b) => b.playedAt.localeCompare(a.playedAt))
}

export function createClashClient({ env = process.env, fetchImpl = fetch } = {}) {
  async function request(playerTag, suffix = '') {
    const token = env.CLASH_ROYALE_API_TOKEN?.trim()
    if (!token) throw new ApiError(503, 'A API ainda não foi configurada. Defina CLASH_ROYALE_API_TOKEN no servidor.')
    const mode = env.CLASH_ROYALE_API_MODE?.trim() || 'direct'
    if (!Object.hasOwn(apiUrls, mode)) throw new ApiError(503, 'Configuração inválida de CLASH_ROYALE_API_MODE.')
    try {
      const response = await fetchImpl(`${apiUrls[mode]}/players/${encodeURIComponent(playerTag)}${suffix}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      })
      if (!response.ok) {
        const errors = {
          400: [400, 'A API recusou a tag informada.'],
          401: [503, 'A chave do servidor não foi aceita pela API do Clash Royale.'],
          403: [503, 'A API negou o acesso. Confira a chave e o IP de saída autorizado no portal.'],
          404: [404, 'Jogador não encontrado. Confira sua tag no jogo.'],
          429: [429, 'Limite de consultas atingido. Aguarde um minuto antes de tentar novamente.'],
          503: [503, 'A API do Clash Royale está temporariamente indisponível.'],
        }
        const [status, message] = errors[response.status] || [502, 'Não foi possível consultar o Clash Royale.']
        throw new ApiError(status, message)
      }
      return await response.json()
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw new ApiError(504, 'O Clash Royale demorou para responder. Tente novamente.')
      throw new ApiError(502, 'Não foi possível conectar à API do Clash Royale ou ler a resposta.')
    }
  }

  return {
    async getPlayer(value) {
      const tag = normalizePlayerTag(value)
      const player = await request(tag)
      if (!player || player.tag !== tag || typeof player.name !== 'string') throw new ApiError(502, 'A API retornou um perfil inválido.')
      const number = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null
      return {
        tag, name: player.name.slice(0, 100), trophies: number(player.trophies),
        bestTrophies: number(player.bestTrophies), wins: number(player.wins),
        losses: number(player.losses), matches: number(player.battleCount),
        clan: typeof player.clan?.name === 'string' ? player.clan.name.slice(0, 100) : null,
      }
    },
    async getFriendlyBattles(value) {
      const playerTag = normalizePlayerTag(value)
      const battles = await request(playerTag, '/battlelog')
      return { playerTag, matches: normalizeFriendlyBattles(battles, playerTag), fetchedAt: new Date().toISOString() }
    },
  }
}
