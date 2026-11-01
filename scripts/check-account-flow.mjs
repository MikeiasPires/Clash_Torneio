// Teste isolado: não lê .env, não consulta a API externa e não altera data/x1.sqlite.
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { createSqliteStore } from '../server/store/sqliteStore.mjs'
import { createGroupsService } from '../server/groups/service.mjs'
import { createGroupsHandler } from '../server/groups/handler.mjs'
import { createAuthHandler, createInvitesHandler, createAvatarHandler } from '../server/accounts/handler.mjs'

const store = createSqliteStore(':memory:')
const A = '#P0LY', B = '#QY82'
const matches = Array.from({ length: 6 }, (_, i) => ({ id: i.toString(16).padStart(64, '0'), playedAt: new Date(Date.now() - 60000 - i * 60000).toISOString(),
  left: { id: A, name: 'Nome no jogo A', crowns: i === 5 ? 0 : 3 }, right: { id: B, name: 'Nome no jogo B', crowns: i === 5 ? 3 : 0 } }))
const service = createGroupsService({ store, clash: { getPlayer: async tag => ({ tag, name: 'Nome ' + tag }), getFriendlyBattles: async () => ({ matches }) } })
const options = { env: {}, getService: async () => service }
const handlers = { '/api/auth': createAuthHandler(options), '/api/groups': createGroupsHandler(options), '/api/invites': createInvitesHandler(options), '/api/avatar': createAvatarHandler(options) }
const server = http.createServer((req, res) => handlers[new URL(req.url, 'http://localhost').pathname](req, res))
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
async function call(path, body, cookie = '', method = 'POST') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { Origin: 'http://127.0.0.1:' + port, Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) } }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks)
        resolve({ status: res.statusCode, headers: res.headers, raw, body: res.headers['content-type']?.includes('application/json') ? JSON.parse(raw.toString()) : null })
      })
    })
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
}
const cookieOf = result => result.headers['set-cookie'][0].split(';')[0]
try {
  const password = 'senha de teste longa para x1'
  const owner = await call('/api/auth?action=register', { name: 'Organizador de teste', age: 30, email: 'owner-http@example.test', password })
  assert.equal(owner.status, 201); assert.equal(owner.body.user.isAdmin, true)
  const adminCookie = cookieOf(owner)
  const group = await call('/api/groups?action=create', { name: 'Grupo por convites', tags: [] }, adminCookie)
  assert.equal(group.status, 201)
  const id = group.body.group.id
  const invitation = await call('/api/groups?action=invite&id=' + id, {}, adminCookie)
  assert.equal(invitation.status, 201)
  const token = invitation.body.token
  const png = await sharp(randomBytes(128 * 128 * 3), { raw: { width: 128, height: 128, channels: 3 } }).png().toBuffer()
  assert.ok(png.length > 8192)
  const first = await call('/api/auth?action=register', { name: 'Ana', age: 22, email: 'ana-http@example.test', password, invite: token, photo: 'data:image/png;base64,' + png.toString('base64') })
  assert.equal(first.status, 201); assert.equal(first.body.user.isAdmin, false)
  const firstCookie = cookieOf(first)
  assert.equal((await call('/api/invites?action=join', { token, tag: A }, firstCookie)).status, 200)
  const second = await call('/api/auth?action=register', { name: 'Bruno', age: 23, email: 'bruno-http@example.test', password, invite: token })
  assert.equal(second.status, 201)
  assert.equal((await call('/api/invites?action=join', { token, tag: B }, cookieOf(second))).status, 200)
  assert.equal((await call('/api/groups?action=sync&id=' + id, {}, adminCookie)).status, 200)
  const snapshot = await call('/api/groups?id=' + id, undefined, firstCookie, 'GET')
  assert.equal(snapshot.status, 200); assert.equal(snapshot.body.totalMatches, 6)
  assert.equal(snapshot.body.ranking[0].name, 'Nome ' + A); assert.equal(snapshot.body.ranking[0].wins, 5)
  assert.equal(snapshot.body.members.find(member => member.tag === A).name, 'Nome ' + A)
  assert.equal(snapshot.body.matches[0].left.name, 'Nome no jogo A')
  assert.ok(!JSON.stringify(snapshot.body).includes('"Ana"')); assert.ok(!JSON.stringify(snapshot.body).includes('"Bruno"'))
  assert.equal((await call('/api/auth?action=me', undefined, firstCookie, 'GET')).body.user.name, 'Ana')
  assert.ok(!JSON.stringify(snapshot.body).includes('ana-http@example.test'))
  assert.equal((await call('/api/groups?action=delete&id=' + id, { confirm: true }, firstCookie)).status, 403)
  const photo = await call(first.body.user.avatarUrl, undefined, firstCookie, 'GET')
  assert.equal(photo.status, 200)
  const metadata = await sharp(photo.raw).metadata()
  assert.equal(metadata.format, 'jpeg'); assert.ok(metadata.width <= 384); assert.equal(metadata.exif, undefined)
  await call('/api/auth?action=logout', {}, firstCookie)
  assert.equal((await call('/api/auth?action=me', undefined, firstCookie, 'GET')).body.user, null)
  console.log('HTTP completo aprovado: grupo vazio, convite, cadastro com foto, dois membros, placar 5x1, privacidade e logout.')
} finally { await new Promise(resolve => server.close(resolve)); store.close() }
