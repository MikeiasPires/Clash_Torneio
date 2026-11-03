import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createPgTestDatabase } from '../testing/pglite.mjs'
import { createSqliteStore } from '../store/sqliteStore.mjs'
import { ApiError } from '../clashRoyale.mjs'
import { canonicalMatch, groupSnapshot, storedMatch } from './domain.mjs'

const A = '#P0LY', B = '#QY82', C = '#GG88', D = '#JJ22'
const start = '2026-11-01T12:00:00.000Z'
const players = [A, B, C].map(tag => ({ tag, name: tag }))
function game(n, leftTag = A, rightTag = B, leftCrowns = 3, rightCrowns = 0) {
  return { id: n.toString(16).padStart(64, '0'), playedAt: start,
    left: { id: leftTag, name: leftTag, crowns: leftCrowns }, right: { id: rightTag, name: rightTag, crowns: rightCrowns } }
}

async function pgStore() {
  const db = await createPgTestDatabase()
  async function call(name, args) {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(',')
    const result = await db.query(`select public.${name}(${placeholders}) as value`, args)
    return result.rows[0].value
  }
  return {
    db, close: () => db.close(),
    createGroup: ({ id, name, players, now }) => call('x1_create_group', [id, name, JSON.stringify(players), now]),
    listGroups: () => call('x1_list_groups', []),
    addMembers: (id, players) => call('x1_add_members', [id, JSON.stringify(players)]),
    removeMember: (id, tag) => call('x1_remove_member', [id, tag]),
    deleteGroup: id => call('x1_delete_group', [id]),
    claimPlayers: ({ groupId = null, limit, now, batchId }) => call('x1_claim_players', [groupId, limit, now, batchId]),
    finishPlayer: ({ tag, batchId, matches, error = null, now }) => call('x1_finish_player', [tag, batchId, JSON.stringify(matches.map(canonicalMatch)), error, now]),
    async getSnapshot(id, { offset = 0, limit = 50 } = {}) {
      const data = await call('x1_group_snapshot', [id, offset, limit])
      if (!data.group) throw new ApiError(404, 'Grupo não encontrado.')
      return groupSnapshot({ ...data, matches: data.matches.map(storedMatch) })
    },
  }
}

for (const [name, create] of [['SQLite', async () => createSqliteStore(':memory:')], ['PostgreSQL/Supabase', pgStore]]) {
  test(`${name}: reserva compartilhada permite novo lote em 30 segundos, sem duplicar consultas entre abas`, async t => {
    const store = await create()
    t.after(() => store.close())
    const groupId = randomUUID(), batchId = randomUUID()
    await store.createGroup({ id: groupId, name: 'Coleta a cada 30s', players: players.slice(0, 2), now: start })
    assert.equal((await store.claimPlayers({ groupId, limit: 8, now: start, batchId })).length, 2)
    assert.equal((await store.claimPlayers({ groupId, limit: 8, now: start, batchId: randomUUID() })).length, 0)
    for (const tag of [A, B]) await store.finishPlayer({ tag, batchId, matches: [], now: start })
    assert.equal((await store.claimPlayers({ groupId, limit: 8, now: '2026-11-01T12:00:29.999Z', batchId: randomUUID() })).length, 0)
    assert.equal((await store.claimPlayers({ groupId, limit: 8, now: '2026-11-01T12:00:30.000Z', batchId: randomUUID() })).length, 2)
  })
  test(`${name}: grupos isolados, duplicidade, locks, paginação, rollback e placar acumulado`, async t => {
    const store = await create()
    t.after(() => store.close())
    const groupAB = randomUUID(), groupAC = randomUUID()
    await store.createGroup({ id: groupAB, name: 'Amigos AB', players: players.slice(0, 2), now: start })
    await store.createGroup({ id: groupAC, name: 'Amigos AC', players: [players[0], players[2]], now: start })
    const batch = randomUUID(), otherBatch = randomUUID()
    assert.deepEqual((await store.claimPlayers({ groupId: groupAB, limit: 8, now: start, batchId: batch })).sort(), [A, B].sort())
    assert.deepEqual(await store.claimPlayers({ limit: 8, now: start, batchId: otherBatch }), [C])
    const matches = [game(1), game(2, B, A, 2, 0), game(3, A, B, 1, 1), game(4, A, D)]
    assert.equal((await store.finishPlayer({ tag: A, batchId: batch, matches, now: start })).recorded, 3)
    assert.equal((await store.finishPlayer({ tag: B, batchId: batch, matches, now: start })).recorded, 0)
    assert.equal((await store.finishPlayer({ tag: C, batchId: otherBatch, matches: [game(5, C, A)], now: start })).recorded, 1)
    const snapshot = await store.getSnapshot(groupAB, { limit: 1 })
    assert.equal(snapshot.matches.length, 1)
    assert.equal(snapshot.totalMatches, 3)
    const stats = snapshot.headToHead.find(row => row.playerTag === A && row.opponentTag === B)
    assert.equal(stats.wins, 1); assert.equal(stats.losses, 1); assert.equal(stats.draws, 1); assert.equal(stats.total, 3)
    assert.equal(snapshot.ranking.find(row => row.id === A).matches, 3)
    assert.equal((await store.getSnapshot(groupAC)).totalMatches, 1)
    assert.equal((await store.claimPlayers({ limit: 8, now: start, batchId: randomUUID() })).length, 0)
    const oldBatch = randomUUID(), newBatch = randomUUID()
    await store.claimPlayers({ groupId: groupAB, limit: 8, now: '2026-11-01T12:03:00.000Z', batchId: oldBatch })
    await store.claimPlayers({ groupId: groupAB, limit: 8, now: '2026-11-01T12:06:00.000Z', batchId: newBatch })
    assert.equal((await store.finishPlayer({ tag: A, batchId: oldBatch, matches: [game(6)], now: start })).stale, true)
    await assert.rejects(store.finishPlayer({ tag: A, batchId: newBatch, matches: [game(7), game(8, A, B, 9)], now: start }))
    assert.equal((await store.getSnapshot(groupAB)).totalMatches, 3)
    assert.equal((await store.finishPlayer({ tag: A, batchId: newBatch, matches: [game(7)], now: start })).recorded, 1)
    const duplicateGroup = randomUUID()
    await store.createGroup({ id: duplicateGroup, name: 'Outro grupo AB', players: players.slice(0, 2), now: start })
    assert.equal((await store.getSnapshot(duplicateGroup)).totalMatches, 4)
    assert.equal((await store.listGroups()).length, 3)
    if (store.db) {
      await store.db.exec('set role anon')
      await assert.rejects(store.db.query('select * from public.x1_battles'), /permission denied/)
      await assert.rejects(store.db.query('select public.x1_list_groups()'), /permission denied/)
      await store.db.exec('reset role')
      const rls = await store.db.query("select count(*)::integer as n from pg_class where relname like 'x1_%' and relrowsecurity")
      assert.equal(rls.rows[0].n, 11)
    }
  })
  test(`${name}: adiciona e retira membros, restaura histórico e exclui somente o grupo escolhido`, async t => {
    const store = await create()
    t.after(() => store.close())
    const first = randomUUID(), shared = randomUUID(), batchId = randomUUID()
    await store.createGroup({ id: first, name: 'Grupo editável', players, now: start })
    await store.createGroup({ id: shared, name: 'Grupo preservado', players: players.slice(0, 2), now: start })
    await store.claimPlayers({ limit: 8, now: start, batchId })
    await store.finishPlayer({ tag: A, batchId, matches: [game(1), game(2, A, C)], now: start })
    assert.equal((await store.getSnapshot(first)).totalMatches, 2)
    await store.removeMember(first, C)
    const removed = await store.getSnapshot(first)
    assert.equal(removed.members.length, 2)
    assert.equal(removed.totalMatches, 1)
    assert.equal(removed.ranking.some(player => player.id === C), false)
    assert.equal((await store.listGroups()).find(group => group.id === first).matchCount, 1)
    assert.equal((await store.getSnapshot(shared)).totalMatches, 1)
    assert.equal((await store.addMembers(first, [players[2]])).added, 1)
    assert.equal((await store.getSnapshot(first)).totalMatches, 2)
    assert.equal((await store.addMembers(first, [players[2]])).added, 0)
    await assert.rejects(store.removeMember(first, D))
    await store.removeMember(first, B)
    await store.removeMember(first, A)
    assert.equal((await store.getSnapshot(first)).totalMatches, 0)
    assert.equal((await store.claimPlayers({ groupId: first, limit: 8, now: '2026-11-01T12:05:00.000Z', batchId: randomUUID() })).length, 0)
    await store.deleteGroup(first)
    await assert.rejects(store.getSnapshot(first), { status: 404 })
    assert.equal((await store.getSnapshot(shared)).totalMatches, 1)
    assert.equal((await store.finishPlayer({ tag: B, batchId, matches: [game(9, B, C)], now: start })).recorded, 0)
    await store.deleteGroup(shared)
    assert.equal((await store.finishPlayer({ tag: A, batchId, matches: [game(10)], now: start })).stale, true)
    assert.equal((await store.listGroups()).length, 0)
    const recreated = randomUUID()
    await store.createGroup({ id: recreated, name: 'Grupo novo', players: players.slice(0, 2), now: start })
    assert.equal((await store.getSnapshot(recreated)).totalMatches, 0)
    const full = randomUUID()
    const twenty = Array.from({ length: 20 }, (_, n) => ({ tag: '#P' + n.toString(4).padStart(3, '0').split('').map(d => '0289'[Number(d)]).join(''), name: 'Jogador ' + n }))
    await store.createGroup({ id: full, name: 'Grupo cheio', players: twenty, now: start })
    await assert.rejects(store.addMembers(full, [{ tag: D, name: 'Não cabe' }]))
    assert.equal((await store.getSnapshot(full)).members.length, 20)
    if (store.db) {
      await store.db.exec('set role anon')
      await assert.rejects(store.db.query('select * from public.x1_visible_battles'), /permission denied/)
      await assert.rejects(store.db.query('select public.x1_delete_group($1)', [full]), /permission denied/)
      await assert.rejects(store.db.query('select public.x1_remove_member($1,$2)', [full, D]), /permission denied/)
      await assert.rejects(store.db.query('select public.x1_add_members($1,$2)', [full, '[]']), /permission denied/)
      await store.db.exec('reset role')
    }
  })
}

test('SQLite mantém grupos e partidas depois de fechar e reabrir o arquivo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clash-x1-'))
  const filename = path.join(dir, 'test.sqlite')
  const id = randomUUID(), batchId = randomUUID()
  let store = createSqliteStore(filename)
  try {
    await store.createGroup({ id, name: 'Persistência', players: players.slice(0, 2), now: start })
    await store.claimPlayers({ groupId: id, limit: 8, now: start, batchId })
    await store.finishPlayer({ tag: A, batchId, matches: [game(1)], now: start })
    store.close()
    store = createSqliteStore(filename)
    assert.equal((await store.getSnapshot(id)).totalMatches, 1)
    await store.setEnabled(id, false)
    assert.equal((await store.claimPlayers({ limit: 8, now: '2026-11-01T13:00:00.000Z', batchId: randomUUID() })).length, 0)
  } finally {
    store.close()
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix)
    fs.rmdirSync(dir)
  }
})
