import { timingSafeEqual } from 'node:crypto'
import { ApiError } from '../clashRoyale.mjs'

export function isLocalOrganizer(req, env) {
  if (env.VERCEL || env.NODE_ENV === 'production') return false
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)) return false
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${req.headers.host}`).hostname) }
  catch { return false }
}

export function requireSecret(req, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new ApiError(503, 'Configure a credencial de organização no servidor com pelo menos 32 caracteres.')
  const provided = req.headers.authorization
  const expected = `Bearer ${secret}`
  if (typeof provided !== 'string' || provided.length > 512 || Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    throw new ApiError(401, 'Acesso de organizador necessário.')
  }
}

export function requireSameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Origem da solicitação não permitida.')
  if (req.headers.origin) {
    let sameOrigin = false
    try { sameOrigin = new URL(req.headers.origin).host === req.headers.host } catch { /* Origem inválida. */ }
    if (!sameOrigin) throw new ApiError(403, 'Origem da solicitação não permitida.')
  }
}

export function requireOrganizer(req, env, account = null) {
  requireSameOrigin(req)
  if (account?.isAdmin) return
  if (account) throw new ApiError(403, 'Somente o administrador pode gerenciar o grupo.')
  if (!isLocalOrganizer(req, env)) requireSecret(req, env.GROUPS_ADMIN_TOKEN)
}

export async function readJson(req, maxBytes = 8192) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'Envie os dados no formato JSON.')
  if (Number(req.headers['content-length']) > maxBytes) throw new ApiError(413, 'Solicitação muito grande.')
  let body = req.body
  if (body === undefined) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      if (size > maxBytes) throw new ApiError(413, 'Solicitação muito grande.')
      chunks.push(buffer)
    }
    body = Buffer.concat(chunks).toString('utf8')
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > maxBytes) throw new ApiError(413, 'Solicitação muito grande.')
    try { body = JSON.parse(body) } catch { throw new ApiError(400, 'JSON inválido.') }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > maxBytes) throw new ApiError(400, 'Corpo da solicitação inválido.')
  return body
}

export function jsonResponse(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(body))
}

export function errorResponse(res, error) {
  return jsonResponse(res, error instanceof ApiError ? error.status : 500, {
    error: error instanceof ApiError ? error.message : 'Não foi possível concluir a operação no registrador de x1.',
  })
}
