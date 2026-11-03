import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { createPgTestDatabase } from '../testing/pglite.mjs'

const resetSql = fs.readFileSync(new URL('../../supabase/operations/start-counting-20261103.sql', import.meta.url), 'utf8')
const A = '#P0LY', B = '#QY82'
const now = '2026-11-03T18:00:00.000Z'
function battle(n, playedAt) {
  return { id: n.toString(16).padStart(64, '0'), playedAt,
    left: { id: A, name: 'A', crowns: 3 }, right: { id: B, name: 'B', crowns: 0 } }
}

test('corte em Brasilia remove somente partidas anteriores, impede reimportacao e preserva contas e grupos', async t => {
  const db = await createPgTestDatabase()
  t.after(() => db.close())
  async function call(name, args) {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(',')
    return (await db.query(`select public.${name}(${placeholders}) as value`, args)).rows[0].value
  }
  const group = randomUUID(), account = randomUUID()
  await call('x1_create_group', [group, 'Divisa', JSON.stringify([A, B].map(tag => ({ tag, name: tag }))), now])
  await call('x1_create_account', [JSON.stringify({ id: account, email: 'owner@example.test', passwordHash: 'test-hash', name: 'Owner', age: 30, now })])
  const games = [
    battle(1, '2026-11-03T02:59:59.999Z'),
    battle(2, '2026-11-03T03:00:00.000Z'),
    battle(3, '2026-11-03T12:00:00.000Z'),
  ]
  const batch = randomUUID()
  await call('x1_claim_players', [group, 8, now, batch])
  assert.equal((await call('x1_finish_player', [A, batch, JSON.stringify(games), null, now])).recorded, 3)

  await db.exec(resetSql)
  let snapshot = await call('x1_group_snapshot', [group, 0, 50])
  assert.equal(snapshot.totalMatches, 2)
  assert.deepEqual(snapshot.matches.map(row => row.id).sort(), games.slice(1).map(row => row.id).sort())
  assert.equal(snapshot.headToHead.find(row => row.playerTag === A).wins, 2)
  assert.equal(snapshot.members.length, 2)
  assert.equal((await db.query('select count(*)::integer as n from public.x1_accounts')).rows[0].n, 1)
  assert.equal((await call('x1_finish_player', [B, batch, JSON.stringify(games), null, now])).stale, true)

  await db.exec('set role service_role')
  const freshBatch = randomUUID()
  await call('x1_claim_players', [group, 8, now, freshBatch])
  const next = battle(4, '2026-11-03T17:00:00.000Z')
  assert.equal((await call('x1_finish_player', [A, freshBatch, JSON.stringify([...games, next]), null, now])).recorded, 1)
  snapshot = await call('x1_group_snapshot', [group, 0, 50])
  assert.equal(snapshot.totalMatches, 3)
  assert.ok(snapshot.members.find(row => row.tag === A).lastSuccessAt)
  await assert.rejects(db.query("update public.x1_collection_settings set starts_at = '2000-01-01'"), /permission denied/)
  await db.exec('reset role')

  await db.exec(resetSql)
  assert.equal((await call('x1_group_snapshot', [group, 0, 50])).totalMatches, 3)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query('select * from public.x1_collection_settings'), /permission denied/)
    await assert.rejects(call('x1_finish_player', [A, freshBatch, '[]', null, now]), /permission denied/)
    await db.exec('reset role')
  }
})
