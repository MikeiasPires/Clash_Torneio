import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { ApiError, createClashClient } from '../clashRoyale.mjs'
import { createStore } from '../store/index.mjs'
import { createSqliteStore } from '../store/sqliteStore.mjs'
import { createGroupsHandler, createMonitorHandler } from './handler.mjs'
import { createGroupsService } from './service.mjs'
import { parseGroup } from './domain.mjs'

const A = '#P0LY', B = '#QY82', C = '#GG88'
const now = '2026-11-01T12:00:00.000Z'
const env = { CLASH_ROYALE_API_TOKEN: 'test-secret' }
const body = { name: 'Amigui', tags: [A, B] }
const secret = 'a'.repeat(48)
function res() { return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = JSON.parse(value) } } }
function req(method = 'POST', url = '/api/groups', data = body) {
  return { method, url, body: data, headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } }
}

function fixture() {
  return Array.from({ length: 6 }, (_, index) => ({
    type: 'friendly', battleTime: `20261101T110${index}00.000Z`, gameMode: { id: 1 },
    team: [{ tag: A, name: 'Mestre do Deck', crowns: index === 5 ? 0 : 3 }],
    opponent: [{ tag: B, name: 'Rei da Arena', crowns: index === 5 ? 3 : 0 }],
  }))
}

test('grupo consulta perfis reais da integração, registra 5x1 e não aceita resultados enviados pelo usuário', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  let apiCalls = 0
  const clash = createClashClient({ env, fetchImpl: async url => {
    apiCalls++
    return new Response(JSON.stringify(url.endsWith('/battlelog') ? [...fixture(), { ...fixture()[0], type: 'PvP' }] : {
      tag: url.includes(encodeURIComponent(A)) ? A : B, name: url.includes(encodeURIComponent(A)) ? 'Mestre do Deck' : 'Rei da Arena',
    }))
  } })
  const service = createGroupsService({ store, clash, clock: () => now })
  const handler = createGroupsHandler({ env: {}, getService: async () => service })
  const created = res()
  await handler(req(), created)
  assert.equal(created.statusCode, 201)
  const id = created.body.group.id
  const sync = res()
  await handler(req('POST', `/api/groups?action=sync&id=${id}`, {}), sync)
  assert.equal(sync.statusCode, 200)
  assert.equal(sync.body.recordedMatches, 6)
  const snapshot = await store.getSnapshot(id)
  const row = snapshot.headToHead.find(item => item.playerTag === A)
  assert.equal(row.wins, 5); assert.equal(row.losses, 1); assert.equal(row.total, 6)
  const second = await service.sync(id)
  assert.equal(second.checkedPlayers, 0)
  assert.equal(apiCalls, 4)
  const forged = res()
  await handler(req('POST', `/api/groups?action=sync&id=${id}`, { matches: fixture() }), forged)
  assert.equal(forged.statusCode, 400)
  assert.equal((await store.getSnapshot(id)).totalMatches, 6)
})

test('perfil inexistente não cria grupo parcialmente', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const service = createGroupsService({ store, clash: { getPlayer: async tag => {
    if (tag === B) throw new ApiError(404, 'Jogador não encontrado.')
    return { tag, name: tag }
  } } })
  await assert.rejects(service.createGroup(body), { status: 404 })
  assert.equal((await store.listGroups()).length, 0)
})

test('falha em um jogador preserva partidas coletadas dos demais e respeita o cooldown', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const id = randomUUID()
  await store.createGroup({ id, name: 'Falhas parciais', players: [A, B, C].map(tag => ({ tag, name: tag })), now })
  const clash = createClashClient({ env, fetchImpl: async url => {
    if (url.includes(encodeURIComponent(C))) return new Response('{}', { status: 503 })
    return new Response(JSON.stringify(fixture()))
  } })
  const service = createGroupsService({ store, clash, clock: () => now })
  const report = await service.sync(id)
  assert.equal(report.failures.length, 1)
  assert.equal(report.failures[0].tag, C)
  assert.equal((await store.getSnapshot(id)).totalMatches, 6)
  assert.equal((await service.sync(id)).checkedPlayers, 0)
})

test('validação aceita grupo vazio para convites, normaliza membros e limita entradas', () => {
  assert.equal(parseGroup({ name: ' Teste ', tags: [A, A.toLowerCase(), B] }).tags.length, 2)
  assert.deepEqual(parseGroup({ name: 'Por convites' }).tags, [])
  assert.equal(parseGroup({ name: 'Teste', tags: [A, A] }).tags.length, 1)
  for (const invalid of [{ name: '', tags: [A, B] }, { ...body, wins: 999 }, { ...body, tags: Array(21).fill(A) }]) {
    assert.throws(() => parseGroup(invalid), { status: 400 })
  }
})

test('produção exige segredo e rejeita origem externa antes de acessar o banco', async () => {
  const handler = createGroupsHandler({ env: { VERCEL: '1', GROUPS_ADMIN_TOKEN: secret }, getService: async () => { assert.fail('Não deveria acessar o banco') } })
  const unauthorized = res(); await handler(req(), unauthorized)
  assert.equal(unauthorized.statusCode, 401)
  const crossSite = req(); crossSite.headers.origin = 'https://outro.example'; crossSite.headers.authorization = `Bearer ${secret}`
  const forbidden = res(); await handler(crossSite, forbidden)
  assert.equal(forbidden.statusCode, 403)
  const rebinding = req(); rebinding.headers.host = 'invasor.example'; rebinding.headers.origin = 'http://invasor.example'
  const localHandler = createGroupsHandler({ env: { GROUPS_ADMIN_TOKEN: secret }, getService: async () => { assert.fail('Não deveria acessar o banco') } })
  const blocked = res(); await localHandler(rebinding, blocked)
  assert.equal(blocked.statusCode, 401)
})

test('cron exige CRON_SECRET inclusive quando a chamada vem de localhost', async () => {
  const handler = createMonitorHandler({ env: { CRON_SECRET: secret }, getService: async () => ({ sync: async () => ({ checkedPlayers: 0 }) }) })
  const denied = res(); await handler(req('GET'), denied); assert.equal(denied.statusCode, 401)
  const authorized = req('GET'); authorized.headers.authorization = `Bearer ${secret}`
  const accepted = res(); await handler(authorized, accepted); assert.equal(accepted.statusCode, 200)
})

test('Vercel recusa SQLite e não cria fallback silencioso quando falta o Supabase', async () => {
  await assert.rejects(createStore({ VERCEL: '1', X1_STORAGE: 'sqlite' }), { status: 503 })
  await assert.rejects(createStore({ VERCEL: '1' }), { status: 503 })
})

test('API gerencia membros, valida novos perfis e exige confirmação para excluir', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const service = createGroupsService({ store, clash: { getPlayer: async tag => {
    if (tag === C) return { tag, name: 'Novo jogador' }
    throw new ApiError(404, 'Jogador não encontrado.')
  } } })
  const id = randomUUID()
  await store.createGroup({ id, name: 'Gerenciamento', players: [A, B].map(tag => ({ tag, name: tag })), now })
  const handler = createGroupsHandler({ env: {}, getService: async () => service })
  const added = res(); await handler(req('POST', `/api/groups?action=add-members&id=${id}`, { tags: C + ' Novo' }), added)
  assert.equal(added.statusCode, 200); assert.equal(added.body.added, 1)
  const duplicate = res(); await handler(req('POST', `/api/groups?action=add-members&id=${id}`, { tags: [C] }), duplicate)
  assert.equal(duplicate.statusCode, 409)
  const invalid = res(); await handler(req('POST', `/api/groups?action=add-members&id=${id}`, { tags: ['#JJ22'] }), invalid)
  assert.equal(invalid.statusCode, 404)
  assert.equal((await store.getSnapshot(id)).members.length, 3)
  const missingId = res(); await handler(req('POST', '/api/groups?action=remove-member', { tag: C }), missingId)
  assert.equal(missingId.statusCode, 400)
  const removed = res(); await handler(req('POST', `/api/groups?action=remove-member&id=${id}`, { tag: C }), removed)
  assert.equal(removed.statusCode, 200); assert.equal((await store.getSnapshot(id)).members.length, 2)
  for (const body of [{}, { confirm: false }, { confirm: true, matches: [] }]) {
    const rejected = res(); await handler(req('POST', `/api/groups?action=delete&id=${id}`, body), rejected)
    assert.equal(rejected.statusCode, 400)
  }
  const deleted = res(); await handler(req('POST', `/api/groups?action=delete&id=${id}`, { confirm: true }), deleted)
  assert.equal(deleted.statusCode, 200); assert.equal((await store.listGroups()).length, 0)
})

test('ações de remoção e inclusão exigem organizador em produção', async () => {
  const handler = createGroupsHandler({ env: { VERCEL: '1', GROUPS_ADMIN_TOKEN: secret }, getService: async () => { assert.fail('Acesso não autorizado ao banco') } })
  for (const action of ['add-members', 'remove-member', 'delete']) {
    const denied = res()
    await handler(req('POST', `/api/groups?action=${action}&id=${randomUUID()}`, { confirm: true }), denied)
    assert.equal(denied.statusCode, 401)
  }
})
