import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { ApiError } from '../clashRoyale.mjs'

const scrypt = promisify(scryptCallback)
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
let active = 0
const waiting = []
async function derive(password, salt) {
  if (active >= 2) {
    if (waiting.length >= 8) throw new ApiError(429, 'Muitas tentativas simultâneas. Aguarde um instante.')
    await new Promise(resolve => waiting.push(resolve))
  } else active++
  try { return await scrypt(password, salt, 64, options) }
  finally { const next = waiting.shift(); if (next) next(); else active-- }
}

export const hashToken = value => createHash('sha256').update(value).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await derive(password, salt)
  return `scrypt:${salt}:${hash.toString('hex')}`
}

export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split(':') : []
  const valid = parts.length === 3 && parts[0] === 'scrypt' && /^[0-9a-f]{32}$/.test(parts[1]) && /^[0-9a-f]{128}$/.test(parts[2])
  const result = await derive(password, valid ? parts[1] : '00000000000000000000000000000000')
  const expected = valid ? Buffer.from(parts[2], 'hex') : Buffer.alloc(64)
  return valid && timingSafeEqual(result, expected)
}

export function parseSessionCookie(req, env) {
  const name = env.VERCEL || env.NODE_ENV === 'production' ? '__Host-x1_session' : 'x1_session'
  const match = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))
  const token = match?.slice(name.length + 1)
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}

export function sessionCookie(token, env, maxAge = 604800) {
  const secure = Boolean(env.VERCEL || env.NODE_ENV === 'production')
  return `${secure ? '__Host-x1_session' : 'x1_session'}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export async function getRequestAccount(req, env, store) {
  const token = parseSessionCookie(req, env)
  return token ? store.getSession(hashToken(token), new Date().toISOString()) : null
}

export function publicAccount(user) {
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name, age: user.age, isAdmin: user.isAdmin,
    playerTag: user.playerTag, playerName: user.playerName, phrase: user.phrase,
    avatarUrl: user.photoVersion ? `/api/avatar?id=${user.id}&v=${user.photoVersion}` : null }
}
