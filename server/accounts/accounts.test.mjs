import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import sharp from 'sharp'
import { createSqliteStore } from '../store/sqliteStore.mjs'
import { createGroupsService } from '../groups/service.mjs'
import { createGroupsHandler } from '../groups/handler.mjs'
import { createAuthHandler, createAvatarHandler, createInvitesHandler } from './handler.mjs'
import { createAccountsService } from './service.mjs'
import { hashPassword, hashToken, sessionCookie, verifyPassword } from './security.mjs'
import { processPhoto } from './photo.mjs'

const A = '#P0LY', B = '#QY82', C = '#GG88'
const password = 'uma senha longa para os amigui'
const secret = 'o'.repeat(64)
const request = (action, body = {}, cookie = '', method = 'POST') => ({ method, url: '/api/' + action, body,
  headers: { host: '127.0.0.1:5174', origin: 'http://127.0.0.1:5174', 'content-type': 'application/json', cookie }, socket: { remoteAddress: '127.0.0.1' } })
function response() { return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(value) { this.raw = value; this.body = Buffer.isBuffer(value) ? null : JSON.parse(value) } } }
async function call(handler, action, body, cookie, method) {
  const result = response(); await handler(request(action, body, cookie, method), result); return result
}
const cookieOf = result => result.headers['Set-Cookie'].split(';')[0]

test('cadastro, convite, tag, foto, permissões, perfil, login e logout funcionam juntos', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const battle = { id: 'a'.repeat(64), playedAt: new Date(Date.now() - 60_000).toISOString(),
    left: { id: C, name: 'Mik', crowns: 3 }, right: { id: A, name: 'Adversário do jogo', crowns: 1 } }
  const service = createGroupsService({ store, clash: { getPlayer: async tag => ({ tag, name: tag === C ? 'Mik' : 'Adversário do jogo' }), getFriendlyBattles: async () => ({ matches: [battle] }) } })
  const env = { GROUPS_ADMIN_TOKEN: secret }
  const options = { env, getService: async () => service }
  const auth = createAuthHandler(options), groups = createGroupsHandler(options), invites = createInvitesHandler(options), avatars = createAvatarHandler(options)
  const owner = await call(auth, 'auth?action=register', { name: 'Organizador', age: 30, email: 'owner@example.test', password })
  assert.equal(owner.statusCode, 201); assert.equal(owner.body.user.isAdmin, true)
  assert.ok(owner.headers['Set-Cookie'].includes('HttpOnly')); assert.ok(owner.headers['Set-Cookie'].includes('SameSite=Lax'))
  const ownerCookie = cookieOf(owner)
  const group = await call(groups, 'groups?action=create', { name: 'Grupo do convite', tags: [A, B] }, ownerCookie)
  const id = group.body.group.id
  const separate = await call(groups, 'groups?action=create', { name: 'Outro grupo privado', tags: [A, B] }, ownerCookie)
  assert.equal(separate.statusCode, 201)
  const invite = await call(groups, `groups?action=invite&id=${id}`, {}, ownerCookie)
  assert.equal(invite.statusCode, 201); assert.equal(invite.body.token.length, 43)
  const token = invite.body.token
  const inspected = await call(invites, 'invites?action=inspect', { token })
  assert.equal(inspected.statusCode, 200); assert.equal(inspected.body.invite.name, 'Grupo do convite')
  assert.ok(!JSON.stringify(inspected.body).includes(token))
  assert.ok(!Object.hasOwn(inspected.body.invite, 'tag'))
  assert.equal((await call(invites, 'invites?action=join', { token, tag: A }, ownerCookie)).statusCode, 200)
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#369ae3' } }).png().toBuffer()
  const photo = 'data:image/png;base64,' + png.toString('base64')
  const member = await call(auth, 'auth?action=register', { name: 'Pessoa convidada', age: 21, email: 'member@example.test', password, invite: token, photo })
  assert.equal(member.statusCode, 201); assert.equal(member.body.user.isAdmin, false); assert.ok(member.body.user.avatarUrl)
  assert.equal(member.body.user.playerTag, null)
  const memberCookie = cookieOf(member), memberId = member.body.user.id
  const beforeJoin = await call(groups, `groups?id=${id}`, {}, memberCookie, 'GET')
  assert.equal(beforeJoin.statusCode, 403)
  const joined = await call(invites, 'invites?action=join', { token, tag: C }, memberCookie)
  assert.equal(joined.statusCode, 200); assert.equal(joined.body.groupId, id)
  const repeated = await call(invites, 'invites?action=join', { token, tag: C }, memberCookie)
  assert.equal(repeated.body.joined, false)
  assert.equal((await store.getInvite(hashToken(token))).uses, 2)
  assert.equal((await store.getAccount(owner.body.user.id)).playerTag, A)
  assert.equal((await store.getAccount(memberId)).playerTag, C)
  const ownerChange = await call(invites, 'invites?action=join', { token, tag: C }, ownerCookie)
  assert.equal(ownerChange.statusCode, 409)
  assert.match(ownerChange.body.error, /crie ou acesse a conta dele/)
  await service.sync(id)
  const listed = await call(groups, 'groups', {}, memberCookie, 'GET')
  assert.deepEqual(listed.body.groups.map(group => group.id), [id]); assert.equal(listed.body.localOrganizer, false)
  const snapshot = await call(groups, `groups?id=${id}`, {}, memberCookie, 'GET')
  assert.equal(snapshot.body.members.find(member => member.tag === C).name, 'Mik')
  assert.equal(snapshot.body.ranking.find(player => player.id === C).name, 'Mik')
  const recordedPlayer = [snapshot.body.matches[0].left, snapshot.body.matches[0].right].find(player => player.id === C)
  assert.equal(recordedPlayer.name, 'Mik'); assert.equal(recordedPlayer.avatarUrl, member.body.user.avatarUrl)
  assert.ok((await store.getGroupProfiles(id)).every(profile => !Object.hasOwn(profile, 'name')))
  for (const privateField of ['Pessoa convidada', 'Organizador', 'member@example.test', 'owner@example.test', 'passwordHash', 'password_hash', 'token_hash', '"age"']) assert.ok(!JSON.stringify(snapshot.body).includes(privateField))
  const unauthorized = await call(groups, `groups?action=delete&id=${id}`, { confirm: true }, memberCookie)
  assert.equal(unauthorized.statusCode, 403)
  const avatar = await call(avatars, 'avatar?id=' + memberId, {}, memberCookie, 'GET')
  assert.equal(avatar.statusCode, 200); assert.equal(avatar.headers['Content-Type'], 'image/jpeg'); assert.equal(avatar.raw[0], 255)
  const outsider = await call(auth, 'auth?action=register', { name: 'Outra pessoa', age: 22, email: 'outsider@example.test', password })
  assert.equal(outsider.body.user.isAdmin, false)
  const outsiderCookie = cookieOf(outsider)
  assert.equal((await call(avatars, 'avatar?id=' + memberId, {}, outsiderCookie, 'GET')).statusCode, 404)
  assert.equal((await call(invites, 'invites?action=join', { token, tag: C }, outsiderCookie)).statusCode, 409)
  const attack = await call(auth, 'auth?action=profile', { name: 'Atacante', age: 40, phrase: '', id: owner.body.user.id, isAdmin: true }, memberCookie)
  assert.equal(attack.statusCode, 400)
  const updated = await call(auth, 'auth?action=profile', { name: 'Nome atualizado', age: 23, phrase: 'Vem para o x1!' }, memberCookie)
  assert.equal(updated.statusCode, 200); assert.equal(updated.body.user.name, 'Nome atualizado'); assert.equal(updated.body.user.age, 23)
  assert.ok(updated.body.user.avatarUrl); assert.equal(updated.body.user.isAdmin, false)
  const afterUpdate = await call(groups, `groups?id=${id}`, {}, memberCookie, 'GET')
  const ranked = afterUpdate.body.ranking.find(player => player.id === C)
  assert.equal(ranked.name, 'Mik'); assert.equal(ranked.phrase, 'Vem para o x1!'); assert.equal(ranked.avatarUrl, updated.body.user.avatarUrl)
  assert.ok(!JSON.stringify(afterUpdate.body).includes('Nome atualizado'))
  assert.equal((await store.getAccount(owner.body.user.id)).name, 'Organizador')
  assert.equal((await call(auth, 'auth?action=login', { email: 'member@example.test', password: 'senha incorreta' }, memberCookie)).statusCode, 401)
  const login = await call(auth, 'auth?action=login', { email: 'MEMBER@example.test', password }, memberCookie)
  assert.equal(login.statusCode, 200)
  assert.equal((await call(auth, 'auth?action=me', {}, memberCookie, 'GET')).body.user, null)
  const nextCookie = cookieOf(login)
  assert.equal((await call(auth, 'auth?action=logout', {}, nextCookie)).statusCode, 200)
  assert.equal((await call(auth, 'auth?action=me', {}, nextCookie, 'GET')).body.user, null)
  assert.equal((await store.listGroups()).length, 2)
})

test('senhas usam scrypt com salts diferentes e cookies de produção são Secure', async () => {
  const first = await hashPassword(password), second = await hashPassword(password)
  assert.notEqual(first, second); assert.ok(!first.includes(password))
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword('senha diferente', first), false)
  assert.equal(await verifyPassword(password, null), false)
  const cookie = sessionCookie('token', { VERCEL: '1' })
  assert.ok(cookie.startsWith('__Host-x1_session=')); assert.ok(cookie.includes('; Secure')); assert.ok(cookie.includes('; HttpOnly')); assert.ok(!cookie.includes('Domain='))
})

test('fotos inválidas, SVG disfarçado e campos sensíveis forjados são rejeitados', async () => {
  await assert.rejects(processPhoto('data:image/png;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')), { status: 400 })
  await assert.rejects(processPhoto('https://example.test/photo.jpg'), { status: 400 })
  await assert.rejects(processPhoto('data:image/svg+xml;base64,AAAA'), { status: 400 })
  const store = createSqliteStore(':memory:')
  try {
    const auth = createAccountsService({ store, clash: {} })
    await assert.rejects(auth.register({ name: 'Nome', age: 20, email: 'test@example.test', password, isAdmin: true }), { status: 400 })
    await assert.rejects(auth.register({ name: 'Nome', age: 0, email: 'test@example.test', password }), { status: 400 })
  } finally { store.close() }
})

test('convites rotacionados, revogados e expirados não concedem entrada', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const id = randomUUID()
  let now = '2026-11-01T12:00:00.000Z'
  await store.createGroup({ id, name: 'Privado', players: [A, B].map(tag => ({ tag, name: tag })), now })
  const auth = createAccountsService({ store, clash: {}, clock: () => now })
  const first = await auth.createInvite(id), second = await auth.createInvite(id)
  await assert.rejects(auth.inspectInvite(first.token), { status: 410 })
  await store.revokeInvite(id); await assert.rejects(auth.inspectInvite(second.token), { status: 410 })
  const third = await auth.createInvite(id)
  now = '2026-11-10T12:00:00.000Z'
  await assert.rejects(auth.inspectInvite(third.token), { status: 410 })
  await store.deleteGroup(id); assert.equal(await store.getInvite(hashToken(third.token)), null)
})

test('limites de autenticação são persistidos no banco e expiram', async t => {
  const store = createSqliteStore(':memory:'); t.after(() => store.close())
  const data = { key: 'rate-test', limit: 2, now: '2026-11-01T12:00:00.000Z', expiresAt: '2026-11-01T12:15:00.000Z' }
  assert.equal(await store.consumeAuthLimit(data), true); assert.equal(await store.consumeAuthLimit(data), true); assert.equal(await store.consumeAuthLimit(data), false)
  assert.equal(await store.consumeAuthLimit({ ...data, now: '2026-11-01T12:16:00.000Z', expiresAt: '2026-11-01T12:31:00.000Z' }), true)
})
