import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ApiError } from '../clashRoyale.mjs'
import { canonicalMatch, groupSnapshot, LEASE_MS, POLL_INTERVAL_MS, storedMatch } from '../groups/domain.mjs'
import { createSqliteAccounts } from '../accounts/sqliteAccounts.mjs'
import { normalizeBattleCards } from '../../shared/battleCards.js'

const schema = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS x1_groups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS x1_players (
    tag TEXT PRIMARY KEY, name TEXT NOT NULL, last_attempt_at TEXT,
    last_success_at TEXT, last_error TEXT, lease_until TEXT, lease_token TEXT
  );
  CREATE TABLE IF NOT EXISTS x1_members (
    group_id TEXT NOT NULL REFERENCES x1_groups(id), tag TEXT NOT NULL REFERENCES x1_players(tag),
    PRIMARY KEY(group_id, tag)
  );
  CREATE TABLE IF NOT EXISTS x1_battles (
    id TEXT PRIMARY KEY CHECK(length(id)=64), played_at TEXT NOT NULL,
    left_tag TEXT NOT NULL, right_tag TEXT NOT NULL CHECK(left_tag < right_tag),
    left_name TEXT NOT NULL, right_name TEXT NOT NULL,
    left_crowns INTEGER NOT NULL CHECK(left_crowns BETWEEN 0 AND 3),
    right_crowns INTEGER NOT NULL CHECK(right_crowns BETWEEN 0 AND 3)
  );
  CREATE TABLE IF NOT EXISTS x1_group_battles (
    group_id TEXT NOT NULL REFERENCES x1_groups(id), battle_id TEXT NOT NULL REFERENCES x1_battles(id),
    PRIMARY KEY(group_id,battle_id)
  );
  CREATE INDEX IF NOT EXISTS x1_members_tag ON x1_members(tag);
  CREATE INDEX IF NOT EXISTS x1_battles_time ON x1_battles(played_at DESC,id DESC);
  BEGIN;
  DROP VIEW IF EXISTS x1_results;
  DROP VIEW IF EXISTS x1_visible_battles;
  CREATE VIEW x1_visible_battles AS
    SELECT gb.group_id,b.* FROM x1_battles b JOIN x1_group_battles gb ON gb.battle_id=b.id
    JOIN x1_members l ON l.group_id=gb.group_id AND l.tag=b.left_tag
    JOIN x1_members r ON r.group_id=gb.group_id AND r.tag=b.right_tag;
  CREATE VIEW x1_results AS
    SELECT b.group_id, b.left_tag AS player_tag, b.right_tag AS opponent_tag,
      (b.left_crowns>b.right_crowns) AS won, (b.left_crowns<b.right_crowns) AS lost,
      (b.left_crowns=b.right_crowns) AS drawn
    FROM x1_visible_battles b
    UNION ALL
    SELECT b.group_id,b.right_tag,b.left_tag,
      (b.right_crowns>b.left_crowns),(b.right_crowns<b.left_crowns),(b.right_crowns=b.left_crowns)
    FROM x1_visible_battles b;
  COMMIT;
`

export function createSqliteStore(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(schema)
  const columns = new Set(db.prepare('PRAGMA table_info(x1_battles)').all().map(column => column.name))
  for (const column of ['left_cards', 'right_cards']) {
    if (!columns.has(column)) db.exec(`ALTER TABLE x1_battles ADD COLUMN ${column} TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(${column}) AND json_type(${column})='array' AND json_array_length(${column})<=8)`)
  }
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE')
    try { const result = action(); db.exec('COMMIT'); return result }
    catch (error) { db.exec('ROLLBACK'); throw error }
  }
  function findGroup(id) {
    const group = db.prepare('SELECT * FROM x1_groups WHERE id=?').get(id)
    if (!group) throw new ApiError(404, 'Grupo não encontrado.')
    return { id: group.id, name: group.name, enabled: Boolean(group.enabled), createdAt: group.created_at }
  }
  function linkKnownBattles(id) {
    db.prepare(`INSERT OR IGNORE INTO x1_group_battles(group_id,battle_id)
      SELECT ?,b.id FROM x1_battles b
      JOIN x1_members l ON l.tag=b.left_tag AND l.group_id=?
      JOIN x1_members r ON r.tag=b.right_tag AND r.group_id=?`).run(id, id, id)
  }
  return {
    ...createSqliteAccounts(db, transaction, linkKnownBattles),
    close() { db.close() },
    async createGroup({ id, name, players, now }) {
      return transaction(() => {
        db.prepare('INSERT INTO x1_groups(id,name,created_at) VALUES(?,?,?)').run(id, name, now)
        const playerStatement = db.prepare('INSERT INTO x1_players(tag,name) VALUES(?,?) ON CONFLICT(tag) DO UPDATE SET name=excluded.name')
        const memberStatement = db.prepare('INSERT INTO x1_members(group_id,tag) VALUES(?,?)')
        for (const player of players) { playerStatement.run(player.tag, player.name); memberStatement.run(id, player.tag) }
        linkKnownBattles(id)
        return findGroup(id)
      })
    },
    async listGroups() {
      return db.prepare(`SELECT g.id,g.name,g.enabled,g.created_at AS createdAt,
        (SELECT count(*) FROM x1_members m WHERE m.group_id=g.id) AS memberCount,
        (SELECT count(*) FROM x1_visible_battles b WHERE b.group_id=g.id) AS matchCount
        FROM x1_groups g ORDER BY g.created_at DESC,g.id`).all().map(row => ({ ...row, enabled: Boolean(row.enabled) }))
    },
    async setEnabled(id, enabled) {
      findGroup(id)
      db.prepare('UPDATE x1_groups SET enabled=? WHERE id=?').run(Number(enabled), id)
      return findGroup(id)
    },
    async addMembers(id, players) {
      return transaction(() => {
        findGroup(id)
        const current = new Set(db.prepare('SELECT tag FROM x1_members WHERE group_id=?').all(id).map(row => row.tag))
        const additions = players.filter(player => !current.has(player.tag))
        if (current.size + additions.length > 20) throw new ApiError(409, 'O grupo pode ter no máximo 20 jogadores.')
        for (const player of additions) {
          db.prepare('INSERT INTO x1_players(tag,name) VALUES(?,?) ON CONFLICT(tag) DO UPDATE SET name=excluded.name').run(player.tag, player.name)
          db.prepare('INSERT INTO x1_members(group_id,tag) VALUES(?,?)').run(id, player.tag)
        }
        linkKnownBattles(id)
        return { added: additions.length }
      })
    },
    async removeMember(id, tag) {
      return transaction(() => {
        findGroup(id)
        if (!db.prepare('DELETE FROM x1_members WHERE group_id=? AND tag=?').run(id, tag).changes) throw new ApiError(404, 'Jogador não encontrado neste grupo.')
        return { removed: tag }
      })
    },
    async deleteGroup(id) {
      return transaction(() => {
        findGroup(id)
        const battles = db.prepare('SELECT battle_id FROM x1_group_battles WHERE group_id=?').all(id)
        db.prepare('DELETE FROM x1_group_battles WHERE group_id=?').run(id)
        db.prepare('DELETE FROM x1_members WHERE group_id=?').run(id)
        db.prepare('DELETE FROM x1_groups WHERE id=?').run(id)
        const removeBattle = db.prepare('DELETE FROM x1_battles WHERE id=? AND NOT EXISTS(SELECT 1 FROM x1_group_battles WHERE battle_id=?)')
        for (const row of battles) removeBattle.run(row.battle_id, row.battle_id)
        db.prepare(`DELETE FROM x1_players WHERE NOT EXISTS(SELECT 1 FROM x1_members m WHERE m.tag=x1_players.tag)
          AND NOT EXISTS(SELECT 1 FROM x1_battles b WHERE b.left_tag=x1_players.tag OR b.right_tag=x1_players.tag)`).run()
        return { deleted: id }
      })
    },
    async claimPlayers({ groupId = null, limit, now, batchId }) {
      if (groupId) findGroup(groupId)
      const dueBefore = new Date(Date.parse(now) - POLL_INTERVAL_MS).toISOString()
      const until = new Date(Date.parse(now) + LEASE_MS).toISOString()
      return transaction(() => {
        const rows = db.prepare(`SELECT p.tag FROM x1_players p WHERE
          (p.last_attempt_at IS NULL OR p.last_attempt_at<=?) AND (p.lease_until IS NULL OR p.lease_until<=?)
          AND EXISTS(SELECT 1 FROM x1_members m JOIN x1_groups g ON g.id=m.group_id
            WHERE m.tag=p.tag AND g.enabled=1 AND (? IS NULL OR m.group_id=?)
            AND (SELECT count(*) FROM x1_members count_members WHERE count_members.group_id=g.id)>=2)
          ORDER BY coalesce(p.last_attempt_at,''),p.tag LIMIT ?`).all(dueBefore, now, groupId, groupId, limit)
        const statement = db.prepare('UPDATE x1_players SET last_attempt_at=?,lease_until=?,lease_token=? WHERE tag=?')
        for (const row of rows) statement.run(now, until, batchId, row.tag)
        return rows.map(row => row.tag)
      })
    },
    async finishPlayer({ tag, batchId, matches, error = null, now }) {
      return transaction(() => {
        if (!db.prepare('SELECT 1 FROM x1_players WHERE tag=? AND lease_token=?').get(tag, batchId)) return { stale: true, recorded: 0 }
        let recorded = 0
        for (const source of matches) {
          const match = canonicalMatch(source)
          if (![match.left.id, match.right.id].includes(tag)) continue
          const groups = db.prepare(`SELECT l.group_id FROM x1_members l JOIN x1_members r ON r.group_id=l.group_id
            WHERE l.tag=? AND r.tag=?`).all(match.left.id, match.right.id)
          if (!groups.length) continue
          db.prepare(`INSERT INTO x1_battles(id,played_at,left_tag,right_tag,left_name,right_name,left_crowns,right_crowns,left_cards,right_cards)
            VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            left_cards=CASE WHEN x1_battles.left_cards='[]' THEN excluded.left_cards ELSE x1_battles.left_cards END,
            right_cards=CASE WHEN x1_battles.right_cards='[]' THEN excluded.right_cards ELSE x1_battles.right_cards END`).run(
            match.id, match.playedAt, match.left.id, match.right.id, match.left.name, match.right.name, match.left.crowns, match.right.crowns,
            JSON.stringify(normalizeBattleCards(match.left.cards)), JSON.stringify(normalizeBattleCards(match.right.cards)))
          for (const group of groups) recorded += db.prepare('INSERT OR IGNORE INTO x1_group_battles VALUES(?,?)').run(group.group_id, match.id).changes
        }
        db.prepare(`UPDATE x1_players SET last_success_at=CASE WHEN ? IS NULL THEN ? ELSE last_success_at END,
          last_error=?,lease_until=NULL,lease_token=NULL WHERE tag=? AND lease_token=?`).run(error, now, error, tag, batchId)
        return { stale: false, recorded }
      })
    },
    async getSnapshot(id, { offset = 0, limit = 50 } = {}) {
      const group = findGroup(id)
      const members = db.prepare(`SELECT p.tag,p.name,p.last_success_at AS lastSuccessAt,p.last_error AS lastError
        FROM x1_players p JOIN x1_members m ON m.tag=p.tag WHERE m.group_id=? ORDER BY p.name,p.tag`).all(id)
      const matches = db.prepare(`SELECT b.* FROM x1_visible_battles b
        WHERE b.group_id=? ORDER BY b.played_at DESC,b.id DESC LIMIT ? OFFSET ?`).all(id, limit, offset).map(storedMatch)
      const headToHead = db.prepare(`SELECT player_tag AS playerTag,opponent_tag AS opponentTag,
        sum(won) AS wins,sum(lost) AS losses,sum(drawn) AS draws,count(*) AS total
        FROM x1_results WHERE group_id=? GROUP BY player_tag,opponent_tag`).all(id)
      const totalMatches = db.prepare('SELECT count(*) AS count FROM x1_visible_battles WHERE group_id=?').get(id).count
      return groupSnapshot({ group, members, matches, headToHead, totalMatches })
    },
  }
}
