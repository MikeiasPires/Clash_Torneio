import process from 'node:process'
import { ApiError } from '../clashRoyale.mjs'
import { assertGroupId, BATCH_SIZE, POLL_INTERVAL_MS } from './domain.mjs'
import { errorResponse, isLocalOrganizer, jsonResponse, readJson, requireOrganizer, requireSecret } from './http.mjs'
import { getGroupsService } from './service.mjs'
import { getRequestAccount, parseSessionCookie } from '../accounts/security.mjs'
import { createAccountsService } from '../accounts/service.mjs'

export function createGroupsHandler({ env = process.env, getService = () => getGroupsService(env) } = {}) {
  return async (req, res) => {
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new ApiError(405, 'Método não permitido.') }
      const query = new URL(req.url, 'http://localhost').searchParams
      if ([...query.keys()].some(key => !['id', 'action', 'offset'].includes(key) || query.getAll(key).length !== 1)) throw new ApiError(400, 'Parâmetros inválidos.')
      const id = query.has('id') ? assertGroupId(query.get('id')) : null
      let service, account = null
      if (parseSessionCookie(req, env)) {
        service = await getService()
        account = await getRequestAccount(req, env, service.store)
        if (!account) throw new ApiError(401, 'Sua sessão expirou. Entre novamente.')
      }
      if (req.method === 'GET') {
        const offset = query.get('offset') || '0'
        if (!/^\d{1,7}$/.test(offset) || query.has('action')) throw new ApiError(400, 'Parâmetros inválidos.')
        const manager = account?.isAdmin || (!account && isLocalOrganizer(req, env))
        if (!account && !manager) throw new ApiError(401, 'Entre na sua conta para ver seus grupos.')
        service ||= await getService()
        if (id && !manager && !await service.store.accountHasGroup(account.id, id)) throw new ApiError(403, 'Você não participa deste grupo.')
        const ids = account && !manager ? new Set(await service.store.listAccountGroupIds(account.id)) : null
        const body = id ? await service.getSnapshot(id, { offset: Number(offset) }) : {
          groups: (await service.store.listGroups()).filter(group => !ids || ids.has(group.id)),
          localOrganizer: Boolean(manager), intervalSeconds: POLL_INTERVAL_MS / 1000, batchSize: BATCH_SIZE,
        }
        return jsonResponse(res, 200, body)
      }
      requireOrganizer(req, env, account)
      const action = query.get('action') || 'create'
      if (query.has('offset') || !['create', 'sync', 'toggle', 'add-members', 'remove-member', 'delete', 'invite', 'revoke-invite'].includes(action)) throw new ApiError(400, 'Ação inválida.')
      const body = await readJson(req)
      service ||= await getService()
      if (['invite', 'revoke-invite'].includes(action)) {
        if (!id || Object.keys(body).length) throw new ApiError(400, 'Informe somente o grupo do convite.')
        if (action === 'invite') return jsonResponse(res, 201, await createAccountsService(service).createInvite(id))
        await service.store.revokeInvite(id)
        return jsonResponse(res, 200, { revoked: true })
      }
      if (action === 'create') {
        if (id) throw new ApiError(400, 'Não informe um ID ao criar um grupo.')
        return jsonResponse(res, 201, { group: await service.createGroup(body) })
      }
      if (action === 'sync') {
        if (Object.keys(body).length) throw new ApiError(400, 'Os resultados são consultados na API; não envie partidas pelo formulário.')
        return jsonResponse(res, 200, await service.sync(id))
      }
      if (['add-members', 'remove-member', 'delete'].includes(action)) {
        if (!id) throw new ApiError(400, 'Informe o grupo que deseja alterar.')
        const methods = { 'add-members': 'addMembers', 'remove-member': 'removeMember', delete: 'deleteGroup' }
        return jsonResponse(res, 200, await service[methods[action]](id, body))
      }
      if (!id || typeof body.enabled !== 'boolean' || Object.keys(body).length !== 1) throw new ApiError(400, 'Informe o grupo e o estado do monitoramento.')
      return jsonResponse(res, 200, { group: await service.store.setEnabled(id, body.enabled) })
    } catch (error) { return errorResponse(res, error) }
  }
}

export function createMonitorHandler({ env = process.env, getService = () => getGroupsService(env) } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new ApiError(405, 'Método não permitido.') }
      requireSecret(req, env.CRON_SECRET)
      return jsonResponse(res, 200, await (await getService()).sync())
    } catch (error) { return errorResponse(res, error) }
  }
}
