import { parseGroupTags } from '../../shared/playerTag.js'
import { ApiError } from '../clashRoyale.mjs'
import { GROUP_POLL_INTERVAL_MS } from '../../shared/groupTiming.js'

export const BATCH_SIZE = 8
export const POLL_INTERVAL_MS = GROUP_POLL_INTERVAL_MS
export const LEASE_MS = 120_000

export function parseGroup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['name', 'tags'].includes(key))) {
    throw new ApiError(400, 'Informe o nome e as tags do grupo.')
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 60) throw new ApiError(400, 'O nome do grupo deve ter de 1 a 60 caracteres.')
  let tags
  try { tags = parseGroupTags(body.tags ?? []) }
  catch (error) { throw new ApiError(400, error.message) }
  return { name, tags }
}

export function assertGroupId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, 'Identificador de grupo inválido.')
  }
  return id
}

export async function mapLimit(items, limit, action) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await action(items[index])
    }
  }))
  return results
}

export function canonicalMatch(match) {
  return match.left.id < match.right.id ? match : { ...match, left: match.right, right: match.left }
}

export function storedMatch(row) {
  return {
    id: row.id, playedAt: row.played_at,
    left: { id: row.left_tag, name: row.left_name, crowns: row.left_crowns },
    right: { id: row.right_tag, name: row.right_name, crowns: row.right_crowns },
  }
}

export function groupSnapshot({ group, members, matches, headToHead, totalMatches }) {
  const ranking = members.map(member => {
    const results = headToHead.filter(row => row.playerTag === member.tag)
    return {
      id: member.tag, name: member.name,
      wins: results.reduce((n, row) => n + row.wins, 0),
      losses: results.reduce((n, row) => n + row.losses, 0),
      draws: results.reduce((n, row) => n + row.draws, 0),
      matches: results.reduce((n, row) => n + row.total, 0),
    }
  }).sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.id.localeCompare(b.id))
  return { group, members, matches, headToHead, totalMatches, ranking }
}
