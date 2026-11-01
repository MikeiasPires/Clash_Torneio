import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
export async function createPgTestDatabase() {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  const migrations = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(new URL(file, migrations), 'utf8'))
  }
  return db
}
