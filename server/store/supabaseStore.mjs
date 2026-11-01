import { createClient } from '@supabase/supabase-js'
import { ApiError } from '../clashRoyale.mjs'
import { canonicalMatch, groupSnapshot, storedMatch } from '../groups/domain.mjs'
import { createSupabaseAccounts } from '../accounts/supabaseAccounts.mjs'

export function createSupabaseStore(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError(503, 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend.')
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8_000) }) },
  })
  async function call(name, parameters) {
    const { data, error } = await client.rpc(name, parameters)
    const accountErrors = {
      invite_invalid: [410, 'Convite inválido, expirado ou sem vagas. Peça um novo link ao administrador.'],
      tag_changed: [409, 'Esta conta já está vinculada a outra tag. Para cadastrar outro jogador, crie ou acesse a conta dele pelo convite.'],
      tag_taken: [409, 'Esta tag já está vinculada a outra conta do aplicativo.'],
      account_missing: [401, 'Entre na sua conta para continuar.'],
    }
    if (error && Object.hasOwn(accountErrors, error.message)) throw new ApiError(...accountErrors[error.message])
    if (name === 'x1_create_account' && error?.code === '23505') throw new ApiError(409, 'Não foi possível criar a conta com esses dados. Tente entrar ou use outro e-mail.')
    if (error?.message === 'member_limit') throw new ApiError(409, 'O grupo pode ter no máximo 20 jogadores.')
    if (error?.message === 'member_not_found') throw new ApiError(404, 'Jogador não encontrado neste grupo.')
    if (error) throw new ApiError(error.code === 'P0002' ? 404 : 503, error.code === 'P0002' ? 'Grupo não encontrado.' : 'Não foi possível acessar o banco. Confira a configuração e a migração do Supabase.')
    return data
  }
  return {
    ...createSupabaseAccounts(client, call),
    async createGroup({ id, name, players, now }) { return call('x1_create_group', { p_id: id, p_name: name, p_players: players, p_now: now }) },
    async listGroups() { return call('x1_list_groups') },
    async addMembers(id, players) { return call('x1_add_members', { p_id: id, p_players: players }) },
    async removeMember(id, tag) { return call('x1_remove_member', { p_id: id, p_tag: tag }) },
    async deleteGroup(id) { return call('x1_delete_group', { p_id: id }) },
    async setEnabled(id, enabled) {
      const { data, error } = await client.from('x1_groups').update({ enabled }).eq('id', id).select('id,name,enabled,created_at').maybeSingle()
      if (error) throw new ApiError(503, 'Não foi possível atualizar o grupo.')
      if (!data) throw new ApiError(404, 'Grupo não encontrado.')
      return { id: data.id, name: data.name, enabled: data.enabled, createdAt: data.created_at }
    },
    async claimPlayers({ groupId = null, limit, now, batchId }) {
      return call('x1_claim_players', { p_group_id: groupId, p_limit: limit, p_now: now, p_batch_id: batchId })
    },
    async finishPlayer({ tag, batchId, matches, error = null, now }) {
      return call('x1_finish_player', { p_tag: tag, p_batch_id: batchId, p_matches: matches.map(canonicalMatch), p_error: error, p_now: now })
    },
    async getSnapshot(id, { offset = 0, limit = 50 } = {}) {
      const data = await call('x1_group_snapshot', { p_id: id, p_offset: offset, p_limit: limit })
      if (!data.group) throw new ApiError(404, 'Grupo não encontrado.')
      return groupSnapshot({ ...data, matches: data.matches.map(storedMatch) })
    },
  }
}
