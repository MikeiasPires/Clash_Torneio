import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createPgTestDatabase } from '../testing/pglite.mjs'

test('PostgreSQL: convite entra atomicamente, respeita tag única, privacidade, capacidade e revogação', async t => {
  const db = await createPgTestDatabase(); t.after(() => db.close())
  const now = '2026-11-01T12:00:00.000Z', expires = '2026-11-08T12:00:00.000Z'
  const group = randomUUID(), account = randomUUID(), outsider = randomUUID()
  const A = '#P0LY', B = '#QY82'
  await db.query('select public.x1_create_group($1,$2,$3,$4)', [group, 'Grupo vazio', '[]', now])
  async function createAccount(id, email) {
    await db.query('select public.x1_create_account($1)', [JSON.stringify({ id, email, passwordHash: 'hash-de-teste', name: 'Nome privado', age: 25, photo: null, photoVersion: null, now, localBootstrap: false })])
  }
  await createAccount(account, 'member@example.test'); await createAccount(outsider, 'other@example.test')
  await assert.rejects(createAccount(randomUUID(), 'member@example.test'), /unique constraint/)
  await db.query('select public.x1_rotate_invite($1,$2,$3)', [group, 'hashed-invite', expires])
  const join = async (user, tag, token = 'hashed-invite') => (await db.query('select public.x1_join_invite($1,$2,$3,$4) as result', [token, user, JSON.stringify({ tag, name: 'Nome no jogo' }), now])).rows[0].result
  assert.equal((await join(account, A)).joined, true)
  assert.equal((await join(account, A)).joined, false)
  assert.equal((await db.query('select uses from public.x1_invites')).rows[0].uses, 1)
  await assert.rejects(join(outsider, A), /tag_taken/)
  await assert.rejects(join(account, B), /tag_changed/)
  assert.equal((await db.query('select count(*)::integer as n from public.x1_group_accounts')).rows[0].n, 1)
  await db.query('select public.x1_remove_member($1,$2)', [group, A])
  assert.equal((await db.query('select count(*)::integer as n from public.x1_group_accounts')).rows[0].n, 0)
  assert.equal((await join(account, A)).joined, true)
  await db.query('update public.x1_invites set revoked=true where group_id=$1', [group])
  await assert.rejects(join(outsider, B), /invite_invalid/)
  await db.query('select public.x1_rotate_invite($1,$2,$3)', [group, 'new-hash', expires])
  await assert.rejects(join(outsider, B), /invite_invalid/)
  assert.equal((await join(outsider, B, 'new-hash')).joined, true)
  const full = Array.from({ length: 18 }, (_, i) => ({ tag: '#P' + i.toString(4).padStart(3, '0').split('').map(d => '0289'[Number(d)]).join(''), name: 'Extra' }))
  await db.query('select public.x1_add_members($1,$2)', [group, JSON.stringify(full)])
  const extra = randomUUID(); await createAccount(extra, 'extra@example.test')
  await assert.rejects(join(extra, '#JJ22', 'new-hash'), /member_limit/)
  assert.equal((await db.query('select player_tag from public.x1_accounts where id=$1', [extra])).rows[0].player_tag, null)
  assert.equal((await db.query('select public.x1_auth_limit($1,2,$2,$3) as allowed', ['test-key', now, expires])).rows[0].allowed, true)
  await db.query('select public.x1_auth_limit($1,2,$2,$3)', ['test-key', now, expires])
  assert.equal((await db.query('select public.x1_auth_limit($1,2,$2,$3) as allowed', ['test-key', now, expires])).rows[0].allowed, false)
  await db.exec('set role anon')
  for (const table of ['x1_accounts', 'x1_sessions', 'x1_invites', 'x1_group_accounts', 'x1_auth_limits']) await assert.rejects(db.query('select * from public.' + table), /permission denied/)
  await assert.rejects(db.query('select public.x1_join_invite($1,$2,$3,$4)', ['new-hash', extra, '{}', now]), /permission denied/)
  await db.exec('reset role')
  await db.query('select public.x1_delete_group($1)', [group])
  assert.equal((await db.query('select count(*)::integer as n from public.x1_invites')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::integer as n from public.x1_group_accounts')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::integer as n from public.x1_accounts')).rows[0].n, 3)
})
