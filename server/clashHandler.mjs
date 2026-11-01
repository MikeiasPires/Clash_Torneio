import { normalizePlayerTag } from '../shared/playerTag.js'
import { ApiError, createClashClient } from './clashRoyale.mjs'

export function createClashHandler(resource, options) {
  const client = createClashClient(options)
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    function send(status, body) {
      res.statusCode = status
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(405, { error: 'Método não permitido.' })
    }
    const query = new URL(req.url, 'http://localhost').searchParams
    let tag
    try {
      if (query.getAll('tag').length !== 1 || [...query.keys()].some((key) => key !== 'tag')) throw new Error('Informe somente uma tag de jogador.')
      tag = normalizePlayerTag(query.get('tag'))
    } catch (error) {
      return send(400, { error: error.message })
    }
    try {
      const data = resource === 'player' ? { player: await client.getPlayer(tag) } : await client.getFriendlyBattles(tag)
      // Apenas dados públicos do jogo. Cache curto reduz consultas repetidas na Vercel.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30')
      return send(200, data)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) res.setHeader('Retry-After', '60')
        return send(error.status, { error: error.message })
      }
      return send(500, { error: 'Não foi possível concluir a consulta.' })
    }
  }
}
