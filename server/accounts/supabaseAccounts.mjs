import { ApiError } from '../clashRoyale.mjs'

const fields = 'id,email,display_name,age,photo_version,phrase,player_tag,player_name,is_admin'
function account(row) {
  return row ? { id: row.id, email: row.email, name: row.display_name, age: row.age, photoVersion: row.photo_version,
    phrase: row.phrase, playerTag: row.player_tag, playerName: row.player_name, isAdmin: row.is_admin } : null
}

export function createSupabaseAccounts(client, call) {
  async function execute(query) {
    const { data, error } = await query
    if (error) throw new ApiError(503, 'Não foi possível acessar os dados da conta. Confira a conexão e as migrações do banco.')
    return data
  }
  async function getAccount(id) { return account(await execute(client.from('x1_accounts').select(fields).eq('id', id).maybeSingle())) }
  return {
    getAccount,
    async createAccount(data) { const id = await call('x1_create_account', { p_data: data }); return getAccount(id) },
    async getCredentials(email) {
      const row = await execute(client.from('x1_accounts').select('id,password_hash').eq('email', email).maybeSingle())
      return row ? { id: row.id, passwordHash: row.password_hash } : null
    },
    async updateAccount(id, { name, age, phrase, photo, photoVersion }) {
      await execute(client.from('x1_accounts').update({ display_name: name, age, phrase, ...(photo ? { photo, photo_version: photoVersion } : {}) }).eq('id', id))
      return getAccount(id)
    },
    async makeAdmin(id) { await execute(client.from('x1_accounts').update({ is_admin: true }).eq('id', id)); return getAccount(id) },
    async createSession({ tokenHash, accountId, expiresAt, now }) {
      await execute(client.from('x1_sessions').delete().lte('expires_at', now))
      await execute(client.from('x1_sessions').insert({ token_hash: tokenHash, account_id: accountId, expires_at: expiresAt }))
    },
    async getSession(hash, now) {
      const row = await execute(client.from('x1_sessions').select('account_id').eq('token_hash', hash).gt('expires_at', now).maybeSingle())
      return row ? getAccount(row.account_id) : null
    },
    async deleteSession(hash) { await execute(client.from('x1_sessions').delete().eq('token_hash', hash)) },
    async consumeAuthLimit({ key, limit, now, expiresAt }) { return call('x1_auth_limit', { p_key: key, p_limit: limit, p_now: now, p_expires_at: expiresAt }) },
    async createInvite({ groupId, tokenHash, expiresAt }) { await call('x1_rotate_invite', { p_group_id: groupId, p_hash: tokenHash, p_expires_at: expiresAt }) },
    async revokeInvite(groupId) { await execute(client.from('x1_invites').update({ revoked: true }).eq('group_id', groupId)) },
    async getInvite(hash) {
      const row = await execute(client.from('x1_invites').select('group_id,expires_at,uses,max_uses,revoked,group:x1_groups(name)').eq('token_hash', hash).maybeSingle())
      if (!row) return null
      const members = await execute(client.from('x1_members').select('tag').eq('group_id', row.group_id))
      return { groupId: row.group_id, name: row.group.name, expiresAt: row.expires_at, uses: row.uses, maxUses: row.max_uses, revoked: row.revoked, memberCount: members.length }
    },
    async accountHasGroup(accountId, groupId) {
      return Boolean(await execute(client.from('x1_group_accounts').select('group_id').eq('account_id', accountId).eq('group_id', groupId).maybeSingle()))
    },
    async listAccountGroupIds(accountId) {
      return (await execute(client.from('x1_group_accounts').select('group_id').eq('account_id', accountId))).map(row => row.group_id)
    },
    async getGroupProfiles(groupId) {
      const rows = await execute(client.from('x1_group_accounts').select('account:x1_accounts(id,player_tag,photo_version,phrase)').eq('group_id', groupId))
      return rows.map(({ account: row }) => ({ id: row.id, tag: row.player_tag, photoVersion: row.photo_version, phrase: row.phrase }))
    },
    async getAvatar(id) {
      const row = await execute(client.from('x1_accounts').select('photo,photo_version').eq('id', id).not('photo', 'is', null).maybeSingle())
      return row ? { photo: row.photo, version: row.photo_version } : null
    },
    async canViewAccount(viewer, target) {
      if (viewer === target) return true
      const groups = await this.listAccountGroupIds(viewer)
      return groups.length ? Boolean((await execute(client.from('x1_group_accounts').select('group_id').eq('account_id', target).in('group_id', groups).limit(1))).length) : false
    },
    async joinInvite({ tokenHash, accountId, player, now }) { return call('x1_join_invite', { p_hash: tokenHash, p_account_id: accountId, p_player: player, p_now: now }) },
  }
}
