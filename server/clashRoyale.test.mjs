import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePlayerTag } from '../shared/playerTag.js'
import { buildHeadToHeadIndex } from '../src/pages/History/headToHead.js'
import { createClashClient, normalizeFriendlyBattles } from './clashRoyale.mjs'
import { createClashHandler } from './clashHandler.mjs'

const env = { CLASH_ROYALE_API_TOKEN: 'test-secret' }
const tag = '#P0LY'
const otherTag = '#QY82'
const player = { tag, name: 'Jogador', crowns: 3 }
const opponent = { tag: otherTag, name: 'Amigo', crowns: 0 }
const battle = { type: 'friendly', battleTime: '20261101T120000.000Z', team: [player], opponent: [opponent], gameMode: { id: 1 } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })

test('normaliza tags e rejeita caminhos, URLs e valores ambíguos', () => {
  assert.equal(normalizePlayerTag(' p0ly '), tag)
  for (const value of ['', '#INVALID', '../../cards', 'https://example.com', ['P0LY'], null]) {
    assert.throws(() => normalizePlayerTag(value), /tag válida/)
  }
})

test('retorna somente amistosos 1x1 válidos envolvendo a tag consultada', () => {
  const matches = normalizeFriendlyBattles([
    battle,
    { ...battle, type: 'PvP' },
    { ...battle, team: [player, opponent] },
    { ...battle, battleTime: '20260230T120000.000Z' },
    { ...battle, opponent: [{ ...opponent, crowns: 5 }] },
    { ...battle, team: [{ ...player, tag: '#GG88' }] },
    null,
  ], tag)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].playedAt, '2026-11-01T12:00:00.000Z')
  assert.equal(matches[0].left.id, tag)
  assert.equal(matches[0].right.id, otherTag)
})

test('a mesma partida tem ID estável ao inverter os lados e não duplica o placar', () => {
  const reversed = { ...battle, team: [opponent], opponent: [player] }
  const a = normalizeFriendlyBattles([battle, reversed], tag)
  const b = normalizeFriendlyBattles([reversed], otherTag)
  assert.equal(a.length, 1)
  assert.equal(a[0].id, b[0].id)
  const stats = buildHeadToHeadIndex(a)
  assert.deepEqual(stats.get(tag).get(otherTag), { wins: 1, losses: 0, draws: 0, total: 1 })
})

test('consulta apenas a URL oficial, codifica # e envia o token somente no cabeçalho', async () => {
  const client = createClashClient({ env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.clashroyale.com/v1/players/%23P0LY/battlelog')
    assert.equal(options.headers.Authorization, 'Bearer test-secret')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    return json([battle])
  } })
  const result = await client.getFriendlyBattles('p0ly')
  assert.equal(result.playerTag, tag)
  assert.equal(result.matches.length, 1)
  assert.ok(!JSON.stringify(result).includes(env.CLASH_ROYALE_API_TOKEN))
})

test('proxy exige configuração explícita e destinos arbitrários são rejeitados', async () => {
  let calls = 0
  const fetchImpl = async (url) => {
    calls++
    assert.equal(url, 'https://proxy.royaleapi.dev/v1/players/%23P0LY')
    return json({ ...player, trophies: 100 })
  }
  await createClashClient({ env: { ...env, CLASH_ROYALE_API_MODE: 'royaleapi' }, fetchImpl }).getPlayer(tag)
  await assert.rejects(createClashClient({ env: { ...env, CLASH_ROYALE_API_MODE: 'https://example.com' }, fetchImpl }).getPlayer(tag), { status: 503 })
  assert.equal(calls, 1)
})

test('perfil expõe somente os campos necessários', async () => {
  const result = await createClashClient({ env, fetchImpl: async () => json({ ...player, trophies: 100, unexpected: 'omit' }) }).getPlayer(tag)
  assert.equal(result.trophies, 100)
  assert.equal(result.losses, null)
  assert.equal(result.unexpected, undefined)
  assert.equal(result.crowns, undefined)
})

test('chave ausente, erros upstream, timeout e falhas de rede geram mensagens seguras', async () => {
  await assert.rejects(createClashClient({ env: {} }).getPlayer(tag), { status: 503 })
  for (const [upstream, status] of [[401, 503], [403, 503], [404, 404], [429, 429], [503, 503], [500, 502]]) {
    const client = createClashClient({ env, fetchImpl: async () => json({ message: 'test-secret' }, upstream) })
    await assert.rejects(client.getPlayer(tag), (error) => error.status === status && !error.message.includes('test-secret'))
  }
  const timeout = createClashClient({ env, fetchImpl: async () => { throw new DOMException('test-secret', 'TimeoutError') } })
  await assert.rejects(timeout.getPlayer(tag), { status: 504 })
  const network = createClashClient({ env, fetchImpl: async () => { throw new TypeError('test-secret') } })
  await assert.rejects(network.getPlayer(tag), { status: 502 })
})

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = JSON.parse(value) } }
}

test('rotas rejeitam método incorreto e tags inválidas antes de acessar a API', async () => {
  const handler = createClashHandler('battles', { env, fetchImpl: async () => { assert.fail('A API não deve ser chamada') } })
  for (const [method, url, status] of [
    ['POST', '/api/battles?tag=P0LY', 405],
    ['GET', '/api/battles', 400],
    ['GET', '/api/battles?tag=P0LY&tag=QY82', 400],
    ['GET', '/api/battles?tag=P0LY&url=https://example.com', 400],
  ]) {
    const res = response()
    await handler({ method, url }, res)
    assert.equal(res.statusCode, status)
    assert.equal(res.headers['Cache-Control'], 'no-store')
    if (status === 405) assert.equal(res.headers.Allow, 'GET')
  }
})

test('rota retorna partidas com cache curto e erros sem dados secretos', async () => {
  const handler = createClashHandler('battles', { env, fetchImpl: async () => json([battle]) })
  const res = response()
  await handler({ method: 'GET', url: '/api/battles?tag=%23P0LY' }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.matches.length, 1)
  assert.match(res.headers['Cache-Control'], /s-maxage=30/)
  const failure = response()
  await createClashHandler('player', { env, fetchImpl: async () => json({ token: 'test-secret' }, 429) })({ method: 'GET', url: '/api/player?tag=P0LY' }, failure)
  assert.equal(failure.statusCode, 429)
  assert.equal(failure.headers['Retry-After'], '60')
  assert.ok(!JSON.stringify(failure).includes('test-secret'))
})
