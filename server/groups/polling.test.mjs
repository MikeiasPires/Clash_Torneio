import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createGroupsHandler } from './handler.mjs'
import { createGroupsService } from './service.mjs'
import { createSqliteStore } from '../store/sqliteStore.mjs'
import { hashToken } from '../accounts/security.mjs'

const groupId = randomUUID(), accountId = randomUUID()
function request({ method = 'POST', query = `action=poll&id=${groupId}`, body = {}, cookie = true, origin = 'https://app.example' } = {}) {
  return { method, url: '/api/groups?' + query, body,
    headers: { host: 'app.example', origin, 'content-type': 'application/json', ...(cookie ? { cookie: '__Host-x1_session=' + 't'.repeat(43) } : {}) } }
}
function response() { return { setHeader() {}, end(value) { this.body = JSON.parse(value) } } }

test('membro autenticado atualiza somente seu grupo, sem ganhar acesso a gerenciamento ou coleta global', async () => {
  let syncCalls = 0, membership = true, allowed = true, limitCalls = 0
  const store = {
    getSession: async () => ({ id: accountId, isAdmin: false }),
    accountHasGroup: async (account, group) => { assert.equal(account, accountId); assert.equal(group, groupId); return membership },
    consumeAuthLimit: async () => { limitCalls++; return allowed },
  }
  const handler = createGroupsHandler({ env: { VERCEL: '1' }, getService: async () => ({ store,
    sync: async id => { assert.equal(id, groupId); syncCalls++; return { checkedPlayers: 2, recordedMatches: 1, failures: [] } },
  }) })
  async function run(options) { const res = response(); await handler(request(options), res); return res }
  const result = await run()
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.recordedMatches, 1)
  assert.equal((await run({ query: 'action=poll' })).statusCode, 400)
  assert.equal((await run({ cookie: false })).statusCode, 401)
  assert.equal((await run({ origin: 'https://other.example' })).statusCode, 403)
  assert.equal((await run({ method: 'GET' })).statusCode, 400)
  assert.equal((await run({ body: { matches: [] } })).statusCode, 400)
  assert.equal((await run({ query: `action=toggle&id=${groupId}`, body: { enabled: false } })).statusCode, 403)
  membership = false
  assert.equal((await run()).statusCode, 403)
  assert.equal(syncCalls, 1)
  assert.equal(limitCalls, 1)
  membership = true; allowed = false
  assert.equal((await run()).statusCode, 429)
  assert.equal(syncCalls, 1)
})

test('coleta automatica grava novas partidas no segundo ciclo de 30 segundos sem botao manual', async t => {
  const store = createSqliteStore(':memory:')
  t.after(() => store.close())
  const A = '#P0LY', B = '#QY82'
  let now = '2026-11-03T18:00:00.000Z', available = []
  const service = createGroupsService({ store, clock: () => now,
    clash: { getFriendlyBattles: async () => ({ matches: available }) },
  })
  await store.createGroup({ id: groupId, name: 'Grupo ativo', players: [A, B].map(tag => ({ tag, name: tag })), now })
  const account = randomUUID()
  await store.createAccount({ id: account, email: 'viewer@example.test', passwordHash: 'test', name: 'Viewer', age: 30, photo: null, photoVersion: null, now })
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString()
  await store.createSession({ tokenHash: hashToken('t'.repeat(43)), accountId: account, expiresAt, now })
  await store.createInvite({ groupId, tokenHash: 'invite', expiresAt })
  await store.joinInvite({ tokenHash: 'invite', accountId: account, player: { tag: A, name: A }, now })
  const handler = createGroupsHandler({ env: { VERCEL: '1' }, getService: async () => service })
  async function poll() { const res = response(); await handler(request(), res); assert.equal(res.statusCode, 200); return res.body }
  assert.equal((await poll()).checkedPlayers, 2)
  available = [{ id: 'a'.repeat(64), playedAt: '2026-11-03T18:00:05.000Z', left: { id: A, name: A, crowns: 3 }, right: { id: B, name: B, crowns: 0 } }]
  now = '2026-11-03T18:00:29.999Z'
  assert.equal((await poll()).checkedPlayers, 0)
  now = '2026-11-03T18:00:30.000Z'
  assert.equal((await poll()).recordedMatches, 1)
  assert.equal((await store.getSnapshot(groupId)).totalMatches, 1)
  assert.equal((await poll()).checkedPlayers, 0)
})
