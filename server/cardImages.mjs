import sharp from 'sharp'
import { isCardImagePath } from '../shared/battleCards.js'
import { ApiError } from './clashRoyale.mjs'
import { errorResponse } from './groups/http.mjs'

const MAX_BYTES = 1_000_000
const CACHE_TTL_MS = 86_400_000

async function readImage(response) {
  if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') {
    await response.body?.cancel()
    throw new ApiError(502, 'O servidor das cartas não retornou uma imagem válida.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new ApiError(502, 'Imagem da carta indisponível.')
  const chunks = []
  let size = 0
  try {
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Image too large')
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) throw new Error('Image too large')
      chunks.push(value)
    }
    const bytes = Buffer.concat(chunks)
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG')
    return await sharp(bytes, { limitInputPixels: 1_000_000, animated: false, failOn: 'warning' })
      .resize(300, 360, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
  } catch {
    await reader.cancel().catch(() => {})
    throw new ApiError(502, 'Não foi possível ler a imagem da carta.')
  } finally { reader.releaseLock() }
}

export function createCardImageHandler({ fetchImpl = fetch, clock = Date.now } = {}) {
  const cache = new Map()
  const pending = new Map()
  async function load(path) {
    const cached = cache.get(path)
    if (cached && cached.expires > clock()) return cached.bytes
    cache.delete(path)
    if (pending.has(path)) return pending.get(path)
    if (pending.size >= 32) throw new ApiError(503, 'Aguarde um instante para carregar as cartas.')
    const promise = (async () => {
      const response = await fetchImpl(`https://api-assets.clashroyale.com${path}`, {
        headers: { Accept: 'image/png' }, signal: AbortSignal.timeout(10_000), redirect: 'error',
      })
      const bytes = await readImage(response)
      if (cache.size >= 64) cache.delete(cache.keys().next().value)
      cache.set(path, { bytes, expires: clock() + CACHE_TTL_MS })
      return bytes
    })()
    pending.set(path, promise)
    try { return await promise } finally { pending.delete(path) }
  }

  return async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD')
        throw new ApiError(405, 'Método não permitido.')
      }
      const query = new URL(req.url, 'http://localhost').searchParams
      const path = query.get('path')
      if ([...query.keys()].some(key => key !== 'path') || query.getAll('path').length !== 1 || !isCardImagePath(path)) {
        throw new ApiError(400, 'Caminho de imagem inválido.')
      }
      const bytes = await load(path)
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/webp')
      res.setHeader('Content-Length', String(bytes.length))
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
      res.end(req.method === 'HEAD' ? undefined : bytes)
    } catch (error) {
      return errorResponse(res, error instanceof ApiError ? error : new ApiError(502, 'Imagem da carta temporariamente indisponível.'))
    }
  }
}
