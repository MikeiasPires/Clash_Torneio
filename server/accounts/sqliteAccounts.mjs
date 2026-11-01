import { ApiError } from '../clashRoyale.mjs'

export function createSqliteAccounts(db, transaction, linkKnownBattles) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS x1_accounts (
      id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,display_name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK(age BETWEEN 1 AND 120),photo TEXT,photo_version TEXT,
      phrase TEXT NOT NULL DEFAULT '',player_tag TEXT UNIQUE,player_name TEXT,is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS x1_sessions (
      token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES x1_accounts(id) ON DELETE CASCADE,expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS x1_sessions_expiry ON x1_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS x1_invites (
      group_id TEXT PRIMARY KEY REFERENCES x1_groups(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,uses INTEGER NOT NULL DEFAULT 0,max_uses INTEGER NOT NULL DEFAULT 20,revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS x1_group_accounts (
      group_id TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES x1_accounts(id) ON DELETE CASCADE,tag TEXT NOT NULL,
      PRIMARY KEY(group_id,account_id),FOREIGN KEY(group_id,tag) REFERENCES x1_members(group_id,tag) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS x1_auth_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TEXT NOT NULL);
  `)
  function account(id) {
    const row = db.prepare(`SELECT id,email,display_name AS name,age,photo_version AS photoVersion,phrase,
      player_tag AS playerTag,player_name AS playerName,is_admin AS isAdmin FROM x1_accounts WHERE id=?`).get(id)
    return row ? { ...row, isAdmin: Boolean(row.isAdmin) } : null
  }
  return {
    async createAccount({ id, email, passwordHash, name, age, photo, photoVersion, now, localBootstrap = false }) {
      return transaction(() => {
        if (db.prepare('SELECT 1 FROM x1_accounts WHERE email=?').get(email)) throw new ApiError(409, 'Não foi possível criar a conta com esses dados. Tente entrar ou use outro e-mail.')
        const admin = localBootstrap && !db.prepare('SELECT 1 FROM x1_accounts LIMIT 1').get()
        db.prepare(`INSERT INTO x1_accounts(id,email,password_hash,display_name,age,photo,photo_version,is_admin,created_at)
          VALUES(?,?,?,?,?,?,?,?,?)`).run(id, email, passwordHash, name, age, photo, photoVersion, Number(admin), now)
        return account(id)
      })
    },
    async getCredentials(email) {
      const row = db.prepare('SELECT id,password_hash AS passwordHash FROM x1_accounts WHERE email=?').get(email)
      return row ? { ...row } : null
    },
    async getAccount(id) { return account(id) },
    async updateAccount(id, { name, age, phrase, photo, photoVersion }) {
      db.prepare(`UPDATE x1_accounts SET display_name=?,age=?,phrase=?,photo=coalesce(?,photo),photo_version=coalesce(?,photo_version) WHERE id=?`)
        .run(name, age, phrase, photo, photoVersion, id)
      return account(id)
    },
    async makeAdmin(id) { db.prepare('UPDATE x1_accounts SET is_admin=1 WHERE id=?').run(id); return account(id) },
    async createSession({ tokenHash, accountId, expiresAt, now }) {
      transaction(() => {
        db.prepare('DELETE FROM x1_sessions WHERE expires_at<=?').run(now)
        db.prepare('INSERT INTO x1_sessions VALUES(?,?,?)').run(tokenHash, accountId, expiresAt)
      })
    },
    async getSession(tokenHash, now) {
      const row = db.prepare('SELECT account_id FROM x1_sessions WHERE token_hash=? AND expires_at>?').get(tokenHash, now)
      return row ? account(row.account_id) : null
    },
    async deleteSession(hash) { db.prepare('DELETE FROM x1_sessions WHERE token_hash=?').run(hash) },
    async consumeAuthLimit({ key, limit, now, expiresAt }) {
      return transaction(() => {
        db.prepare('DELETE FROM x1_auth_limits WHERE expires_at<=?').run(now)
        const row = db.prepare(`INSERT INTO x1_auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).get(key, expiresAt)
        return row.count <= limit
      })
    },
    async createInvite({ groupId, tokenHash, expiresAt }) {
      if (!db.prepare('SELECT 1 FROM x1_groups WHERE id=?').get(groupId)) throw new ApiError(404, 'Grupo não encontrado.')
      db.prepare(`INSERT INTO x1_invites(group_id,token_hash,expires_at) VALUES(?,?,?)
        ON CONFLICT(group_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,uses=0,revoked=0`).run(groupId, tokenHash, expiresAt)
    },
    async revokeInvite(groupId) { db.prepare('UPDATE x1_invites SET revoked=1 WHERE group_id=?').run(groupId) },
    async getInvite(hash) {
      const row = db.prepare(`SELECT i.group_id AS groupId,g.name,i.expires_at AS expiresAt,i.uses,i.max_uses AS maxUses,i.revoked,
        (SELECT count(*) FROM x1_members m WHERE m.group_id=g.id) AS memberCount
        FROM x1_invites i JOIN x1_groups g ON g.id=i.group_id WHERE i.token_hash=?`).get(hash)
      return row ? { ...row, revoked: Boolean(row.revoked) } : null
    },
    async accountHasGroup(accountId, groupId) {
      return Boolean(db.prepare('SELECT 1 FROM x1_group_accounts WHERE account_id=? AND group_id=?').get(accountId, groupId))
    },
    async listAccountGroupIds(accountId) { return db.prepare('SELECT group_id FROM x1_group_accounts WHERE account_id=?').all(accountId).map(row => row.group_id) },
    async getGroupProfiles(groupId) {
      return db.prepare(`SELECT a.id,a.player_tag AS tag,a.photo_version AS photoVersion,a.phrase
        FROM x1_accounts a JOIN x1_group_accounts ga ON ga.account_id=a.id WHERE ga.group_id=?`).all(groupId).map(row => ({ ...row }))
    },
    async getAvatar(id) {
      const row = db.prepare('SELECT photo,photo_version AS version FROM x1_accounts WHERE id=? AND photo IS NOT NULL').get(id)
      return row ? { ...row } : null
    },
    async canViewAccount(viewer, target) {
      return viewer === target || Boolean(db.prepare(`SELECT 1 FROM x1_group_accounts a JOIN x1_group_accounts b ON a.group_id=b.group_id WHERE a.account_id=? AND b.account_id=?`).get(viewer, target))
    },
    async joinInvite({ tokenHash, accountId, player, now }) {
      return transaction(() => {
        const invite = db.prepare('SELECT * FROM x1_invites WHERE token_hash=?').get(tokenHash)
        if (!invite || invite.revoked || invite.expires_at <= now || invite.uses >= invite.max_uses) throw new ApiError(410, 'Convite inválido, expirado ou sem vagas. Peça um novo link ao administrador.')
        const user = account(accountId)
        if (!user) throw new ApiError(401, 'Entre na sua conta para continuar.')
        if (user.playerTag && user.playerTag !== player.tag) throw new ApiError(409, 'Esta conta já está vinculada a outra tag. Para cadastrar outro jogador, crie ou acesse a conta dele pelo convite.')
        if (db.prepare('SELECT 1 FROM x1_accounts WHERE player_tag=? AND id<>?').get(player.tag, accountId)) throw new ApiError(409, 'Esta tag já está vinculada a outra conta do aplicativo.')
        const exists = db.prepare('SELECT 1 FROM x1_members WHERE group_id=? AND tag=?').get(invite.group_id, player.tag)
        const count = db.prepare('SELECT count(*) AS n FROM x1_members WHERE group_id=?').get(invite.group_id).n
        if (!exists && count >= 20) throw new ApiError(409, 'O grupo atingiu o limite de 20 jogadores.')
        db.prepare('INSERT INTO x1_players(tag,name) VALUES(?,?) ON CONFLICT(tag) DO UPDATE SET name=excluded.name').run(player.tag, player.name)
        db.prepare('INSERT OR IGNORE INTO x1_members(group_id,tag) VALUES(?,?)').run(invite.group_id, player.tag)
        db.prepare('UPDATE x1_accounts SET player_tag=?,player_name=? WHERE id=?').run(player.tag, player.name, accountId)
        const added = db.prepare('INSERT OR IGNORE INTO x1_group_accounts VALUES(?,?,?)').run(invite.group_id, accountId, player.tag).changes
        if (added) db.prepare('UPDATE x1_invites SET uses=uses+1 WHERE group_id=?').run(invite.group_id)
        linkKnownBattles(invite.group_id)
        return { groupId: invite.group_id, joined: Boolean(added) }
      })
    },
  }
}
