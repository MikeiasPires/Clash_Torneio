import path from 'node:path'
import { ApiError } from '../clashRoyale.mjs'

export async function createStore(env) {
  const mode = env.X1_STORAGE || (env.VERCEL ? 'supabase' : 'sqlite')
  if (mode === 'sqlite') {
    if (env.VERCEL) throw new ApiError(503, 'Use X1_STORAGE=supabase na Vercel. O banco local não é persistente nesse ambiente.')
    const { createSqliteStore } = await import('./sqliteStore.mjs')
    return createSqliteStore(env.X1_SQLITE_PATH || path.resolve('data/x1.sqlite'))
  }
  if (mode === 'supabase') {
    const { createSupabaseStore } = await import('./supabaseStore.mjs')
    return createSupabaseStore(env)
  }
  throw new ApiError(503, 'X1_STORAGE deve ser sqlite ou supabase.')
}
