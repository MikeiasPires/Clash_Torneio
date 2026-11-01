import process from 'node:process'
import { ApiError } from '../clashRoyale.mjs'
import { getGroupsService } from '../groups/service.mjs'
import { errorResponse, isLocalOrganizer, jsonResponse, readJson, requireSameOrigin, requireSecret } from '../groups/http.mjs'
import { assertGroupId } from '../groups/domain.mjs'
import { createAccountsService } from './service.mjs'
import { getRequestAccount, hashToken, parseSessionCookie, publicAccount, sessionCookie } from './security.mjs'

function requireAccount(user) { if (!user) throw new ApiError(401, 'Entre na sua conta para continuar.') }

export function createAuthHandler({ env = process.env, getService = () => getGroupsService(env) } = {}) {
  return async (req, res) => {
    try {
      const query = new URL(req.url, 'http://localhost').searchParams
      if ([...query.keys()].some(key => key !== 'action') || query.getAll('action').length !== 1) throw new ApiError(400, 'Ação inválida.')
      const action = query.get('action')
      const service = await getService()
      const auth = createAccountsService(service)
      const user = await getRequestAccount(req, env, service.store)
      if (req.method === 'GET' && action === 'me') return jsonResponse(res, 200, { user: publicAccount(user) })
      if (req.method !== 'POST') throw new ApiError(405, 'Método não permitido.')
      requireSameOrigin(req)
      if (!['register', 'login', 'logout', 'profile', 'promote'].includes(action)) throw new ApiError(400, 'Ação inválida.')
      await auth.limit(`auth:${req.socket?.remoteAddress || 'server'}`, 120, 15)
      const body = await readJson(req, ['register', 'profile'].includes(action) ? 3_000_000 : 8192)
      if (['register', 'login'].includes(action)) {
        const account = action === 'register' ? await auth.register(body, isLocalOrganizer(req, env)) : await auth.login(body)
        const previous = parseSessionCookie(req, env)
        if (previous) await service.store.deleteSession(hashToken(previous))
        const token = await auth.createSession(account.id)
        res.setHeader('Set-Cookie', sessionCookie(token, env))
        return jsonResponse(res, action === 'register' ? 201 : 200, { user: publicAccount(account) })
      }
      if (action === 'logout') {
        const token = parseSessionCookie(req, env)
        if (token) await service.store.deleteSession(hashToken(token))
        res.setHeader('Set-Cookie', sessionCookie('', env, 0))
        return jsonResponse(res, 200, { user: null })
      }
      requireAccount(user)
      if (action === 'promote') {
        if (Object.keys(body).length) throw new ApiError(400, 'Não envie dados de outra conta.')
        requireSecret(req, env.GROUPS_ADMIN_TOKEN)
        return jsonResponse(res, 200, { user: publicAccount(await service.store.makeAdmin(user.id)) })
      }
      return jsonResponse(res, 200, { user: publicAccount(await auth.updateProfile(user, body)) })
    } catch (error) { if (error.status === 429) res.setHeader('Retry-After', '900'); return errorResponse(res, error) }
  }
}

export function createInvitesHandler({ env = process.env, getService = () => getGroupsService(env) } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') throw new ApiError(405, 'Método não permitido.')
      requireSameOrigin(req)
      const query = new URL(req.url, 'http://localhost').searchParams
      if (query.getAll('action').length !== 1 || [...query.keys()].some(key => key !== 'action')) throw new ApiError(400, 'Ação inválida.')
      const body = await readJson(req)
      const service = await getService()
      const auth = createAccountsService(service)
      await auth.limit(`invite:${req.socket?.remoteAddress || 'server'}`, 200, 15)
      if (query.get('action') === 'inspect') {
        if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'token')) throw new ApiError(400, 'Informe somente o convite.')
        return jsonResponse(res, 200, { invite: await auth.inspectInvite(body.token) })
      }
      if (query.get('action') !== 'join') throw new ApiError(400, 'Ação inválida.')
      const user = await getRequestAccount(req, env, service.store)
      requireAccount(user)
      return jsonResponse(res, 200, await auth.joinInvite(user, body))
    } catch (error) { return errorResponse(res, error) }
  }
}

export function createAvatarHandler({ env = process.env, getService = () => getGroupsService(env) } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'GET') throw new ApiError(405, 'Método não permitido.')
      const query = new URL(req.url, 'http://localhost').searchParams
      const id = assertGroupId(query.get('id'))
      const service = await getService()
      const user = await getRequestAccount(req, env, service.store)
      requireAccount(user)
      if (!user.isAdmin && !await service.store.canViewAccount(user.id, id)) throw new ApiError(404, 'Foto não encontrada.')
      const avatar = await service.store.getAvatar(id)
      if (!avatar) throw new ApiError(404, 'Foto não encontrada.')
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.setHeader('Vary', 'Cookie')
      res.end(Buffer.from(avatar.photo, 'base64'))
    } catch (error) { return errorResponse(res, error) }
  }
}
