import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { createCardImageHandler } from './cardImages.mjs'
import { battleCardImageSrc } from '../shared/battleCards.js'

const path = '/cards/300/knight.png'
const source = `https://api-assets.clashroyale.com${path}`
const image = await sharp({ create: { width: 2, height: 3, channels: 4, background: '#123456' } }).png().toBuffer()
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = value } }
}
async function call(handler, url = battleCardImageSrc(source), method = 'GET') {
  const res = response()
  await handler({ method, url, headers: { cookie: 'private-cookie', authorization: 'private-token' } }, res)
  return res
}
const png = () => new Response(image, { headers: { 'Content-Type': 'image/png' } })

test('frontend gera URL no próprio domínio; backend entrega imagem WebP real sem enviar credenciais ao CDN', async () => {
  assert.equal(battleCardImageSrc(source), '/api/card-image?path=%2Fcards%2F300%2Fknight.png')
  const handler = createCardImageHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, source)
    assert.deepEqual(options.headers, { Accept: 'image/png' })
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    return png()
  } })
  const res = await call(handler)
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Content-Type'], 'image/webp')
  assert.equal(res.headers['Cross-Origin-Resource-Policy'], 'same-origin')
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
  assert.match(res.headers['Cache-Control'], /public.*s-maxage=86400/)
  assert.equal(res.headers['Content-Length'], String(res.body.length))
  assert.equal((await sharp(res.body).metadata()).format, 'webp')
})

test('requisições simultâneas da mesma carta compartilham a consulta e o cache expira', async () => {
  let calls = 0, now = 0
  const handler = createCardImageHandler({ clock: () => now, fetchImpl: async () => { calls++; return png() } })
  const results = await Promise.all(Array.from({ length: 4 }, () => call(handler)))
  assert.ok(results.every(res => res.statusCode === 200))
  assert.equal(calls, 1)
  const head = await call(handler, battleCardImageSrc(source), 'HEAD')
  assert.equal(head.statusCode, 200)
  assert.equal(head.body, undefined)
  assert.ok(Number(head.headers['Content-Length']) > 0)
  assert.equal(calls, 1)
  now = 86_400_001
  await call(handler)
  assert.equal(calls, 2)
})

test('rota rejeita URLs externas, travessia de diretórios, parâmetros duplicados e métodos de escrita', async () => {
  const handler = createCardImageHandler({ fetchImpl: () => assert.fail('Não deve acessar a rede') })
  for (const url of [
    '/api/card-image', '/api/card-image?path=' + encodeURIComponent('https://evil.test/a.png'),
    '/api/card-image?path=' + encodeURIComponent('/cards/300/../../secret.png'),
    '/api/card-image?path=' + encodeURIComponent('/cards/300/%2e%2e.png'),
    '/api/card-image?path=' + encodeURIComponent('//evil.test/cards/300/a.png'),
    '/api/card-image?path=' + encodeURIComponent('/cards/300/a.svg'),
    battleCardImageSrc(source) + '&path=' + encodeURIComponent(path),
    battleCardImageSrc(source) + '&url=https://evil.test',
  ]) {
    const res = await call(handler, url)
    assert.equal(res.statusCode, 400)
    assert.equal(res.headers['Cache-Control'], 'no-store')
  }
  const method = await call(handler, battleCardImageSrc(source), 'POST')
  assert.equal(method.statusCode, 405)
  assert.equal(method.headers.Allow, 'GET, HEAD')
})

test('HTML, acesso negado, redirecionamento e PNG falso nunca são entregues como imagem', async () => {
  for (const upstream of [
    () => new Response('<html>Access denied: private-token</html>', { status: 403, headers: { 'Content-Type': 'text/html' } }),
    () => new Response('<html>Not an image</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response(null, { status: 302, headers: { Location: 'https://evil.test' } }),
    () => new Response('<html>Fake PNG</html>', { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { 'Content-Type': 'image/png' } }),
  ]) {
    const res = await call(createCardImageHandler({ fetchImpl: async () => upstream() }))
    assert.equal(res.statusCode, 502)
    assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8')
    assert.equal(res.headers['Cache-Control'], 'no-store')
    assert.ok(!res.body.includes('private-token'))
  }
})

test('limita tamanho informado e bytes recebidos mesmo sem Content-Length', async () => {
  for (const upstream of [
    () => new Response(image, { headers: { 'Content-Type': 'image/png', 'Content-Length': '1000001' } }),
    () => new Response(new Uint8Array(1_000_001), { headers: { 'Content-Type': 'image/png' } }),
  ]) {
    const res = await call(createCardImageHandler({ fetchImpl: async () => upstream() }))
    assert.equal(res.statusCode, 502)
    assert.equal(res.headers['Cache-Control'], 'no-store')
  }
})

test('falha temporária não fica no cache e não expõe mensagens internas', async () => {
  let calls = 0
  const handler = createCardImageHandler({ fetchImpl: async () => {
    if (++calls === 1) throw new Error('private-token')
    return png()
  } })
  const failure = await call(handler)
  assert.equal(failure.statusCode, 502)
  assert.ok(!failure.body.includes('private-token'))
  assert.equal((await call(handler)).statusCode, 200)
  assert.equal(calls, 2)
})
