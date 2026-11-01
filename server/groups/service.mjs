import { randomUUID } from 'node:crypto'
import { ApiError, createClashClient } from '../clashRoyale.mjs'
import { createStore } from '../store/index.mjs'
import { normalizePlayerTag, parseGroupTags } from '../../shared/playerTag.js'
import { assertGroupId, BATCH_SIZE, mapLimit, parseGroup } from './domain.mjs'

export function createGroupsService({ store, clash, clock = () => new Date().toISOString() }) {
  async function lookupPlayers(tags) {
    const results = await mapLimit(tags, 4, async tag => {
      try { return { player: await clash.getPlayer(tag) } }
      catch (error) { return { tag, error } }
    })
    const failed = results.find(result => result.error)
    if (failed) throw new ApiError(failed.error.status || 502, `Não foi possível cadastrar ${failed.tag}: ${failed.error instanceof ApiError ? failed.error.message : 'falha na consulta ao Clash Royale.'}`)
    return results.map(result => ({ tag: result.player.tag, name: result.player.name }))
  }
  return {
    store,
    clash,
    async getSnapshot(id, options) {
      const snapshot = await store.getSnapshot(id, options)
      const profiles = new Map((await store.getGroupProfiles(id)).map(profile => [profile.tag, profile]))
      function decorate(player, tag = player.id) {
        const profile = profiles.get(tag)
        return profile ? { ...player, phrase: profile.phrase,
          avatarUrl: profile.photoVersion ? `/api/avatar?id=${profile.id}&v=${profile.photoVersion}` : null } : player
      }
      return { ...snapshot, members: snapshot.members.map(member => decorate(member, member.tag)),
        ranking: snapshot.ranking.map(player => decorate(player)),
        matches: snapshot.matches.map(match => ({ ...match, left: decorate(match.left), right: decorate(match.right) })) }
    },
    async createGroup(body) {
      const { name, tags } = parseGroup(body)
      return store.createGroup({ id: randomUUID(), name, players: await lookupPlayers(tags), now: clock() })
    },
    async addMembers(id, body) {
      assertGroupId(id)
      if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'tags')) throw new ApiError(400, 'Informe somente as tags dos novos jogadores.')
      let tags
      try { tags = parseGroupTags(body.tags) } catch (error) { throw new ApiError(400, error.message) }
      const { members } = await store.getSnapshot(id, { limit: 1 })
      const additions = tags.filter(tag => !members.some(member => member.tag === tag))
      if (!additions.length) throw new ApiError(409, 'Informe pelo menos um jogador que ainda não esteja no grupo.')
      if (members.length + additions.length > 20) throw new ApiError(409, 'O grupo pode ter no máximo 20 jogadores.')
      return store.addMembers(id, await lookupPlayers(additions))
    },
    async removeMember(id, body) {
      assertGroupId(id)
      if (Object.keys(body).length !== 1 || typeof body.tag !== 'string') throw new ApiError(400, 'Informe a tag do jogador a remover.')
      let tag
      try { tag = normalizePlayerTag(body.tag) } catch (error) { throw new ApiError(400, error.message) }
      return store.removeMember(id, tag)
    },
    async deleteGroup(id, body) {
      assertGroupId(id)
      if (Object.keys(body).length !== 1 || body.confirm !== true) throw new ApiError(400, 'Confirme a exclusão do grupo.')
      return store.deleteGroup(id)
    },
    async sync(groupId = null) {
      if (groupId) assertGroupId(groupId)
      const batchId = randomUUID()
      const tags = await store.claimPlayers({ groupId, limit: BATCH_SIZE, now: clock(), batchId })
      const results = await mapLimit(tags, 4, async tag => {
        let matches = [], failure = null
        try {
          const result = await clash.getFriendlyBattles(tag)
          const now = Date.parse(clock())
          matches = result.matches.filter(match => Date.parse(match.playedAt) <= now + 300_000)
        } catch (error) {
          failure = error instanceof ApiError ? error.message : 'Não foi possível consultar o jogador.'
        }
        const saved = await store.finishPlayer({ tag, batchId, matches, error: failure, now: clock() })
        return { tag, error: failure, recorded: saved.recorded, stale: saved.stale }
      })
      return {
        checkedPlayers: tags.length, batchSize: BATCH_SIZE,
        recordedMatches: results.reduce((n, result) => n + result.recorded, 0),
        failures: results.filter(result => result.error).map(({ tag, error }) => ({ tag, error })),
        checkedAt: clock(),
      }
    },
  }
}

const instances = new WeakMap()
export function getGroupsService(env) {
  if (!instances.has(env)) {
    const promise = createStore(env).then(store => createGroupsService({ store, clash: createClashClient({ env }) }))
    instances.set(env, promise)
    promise.catch(() => instances.delete(env))
  }
  return instances.get(env)
}
