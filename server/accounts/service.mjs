import { randomUUID } from 'node:crypto'
import { ApiError } from '../clashRoyale.mjs'
import { normalizePlayerTag } from '../../shared/playerTag.js'
import { hashPassword, hashToken, randomToken, verifyPassword } from './security.mjs'
import { processPhoto } from './photo.mjs'

export function checkFields(body, fields) {
  if (Object.keys(body).some(key => !fields.includes(key))) throw new ApiError(400, 'O formulário contém campos não permitidos.')
}

export function profileFields(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phrase = typeof body.phrase === 'string' ? body.phrase.trim() : ''
  if (!name || name.length > 100) throw new ApiError(400, 'Informe um nome de até 100 caracteres.')
  if (!Number.isInteger(body.age) || body.age < 1 || body.age > 120) throw new ApiError(400, 'Informe uma idade válida, de 1 a 120 anos.')
  if (phrase.length > 160) throw new ApiError(400, 'Sua frase pode ter até 160 caracteres.')
  return { name, age: body.age, phrase }
}

function emailField(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Informe um e-mail válido.')
  return email
}

export function createAccountsService({ store, clash, clock = () => new Date().toISOString() }) {
  async function limit(key, maximum, minutes) {
    const now = clock()
    const allowed = await store.consumeAuthLimit({ key: hashToken(key), limit: maximum, now, expiresAt: new Date(Date.parse(now) + minutes * 60_000).toISOString() })
    if (!allowed) throw new ApiError(429, 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
  }
  async function inspect(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(410, 'Convite inválido ou expirado. Peça um novo link ao administrador.')
    const invite = await store.getInvite(hashToken(token))
    if (!invite || invite.revoked || Date.parse(invite.expiresAt) <= Date.parse(clock()) || invite.uses >= invite.maxUses) throw new ApiError(410, 'Convite inválido, expirado ou sem vagas. Peça um novo link ao administrador.')
    return { groupId: invite.groupId, name: invite.name, expiresAt: invite.expiresAt, memberCount: invite.memberCount }
  }
  return {
    limit,
    async register(body, localBootstrap = false) {
      checkFields(body, ['name', 'age', 'email', 'password', 'photo', 'invite'])
      const email = emailField(body.email)
      if (typeof body.password !== 'string' || body.password.length < 15 || body.password.length > 128) throw new ApiError(400, 'Use uma senha de 15 a 128 caracteres.')
      const profile = profileFields(body)
      if (body.invite) await inspect(body.invite)
      await limit('register:' + email, 5, 60)
      const photo = await processPhoto(body.photo)
      return store.createAccount({ id: randomUUID(), email, passwordHash: await hashPassword(body.password), ...profile, ...photo,
        now: clock(), localBootstrap: localBootstrap && !body.invite })
    },
    async login(body) {
      checkFields(body, ['email', 'password'])
      const email = emailField(body.email)
      if (typeof body.password !== 'string' || !body.password.length || body.password.length > 128) throw new ApiError(401, 'E-mail ou senha inválidos.')
      await limit('login:' + email, 8, 15)
      const credentials = await store.getCredentials(email)
      const valid = await verifyPassword(body.password, credentials?.passwordHash)
      if (!valid || !credentials) throw new ApiError(401, 'E-mail ou senha inválidos.')
      return store.getAccount(credentials.id)
    },
    async createSession(accountId) {
      const token = randomToken()
      const now = clock()
      await store.createSession({ tokenHash: hashToken(token), accountId, now, expiresAt: new Date(Date.parse(now) + 7 * 86400_000).toISOString() })
      return token
    },
    async updateProfile(user, body) {
      checkFields(body, ['name', 'age', 'phrase', 'photo'])
      return store.updateAccount(user.id, { ...profileFields(body), ...await processPhoto(body.photo) })
    },
    async createInvite(groupId) {
      const token = randomToken()
      const expiresAt = new Date(Date.parse(clock()) + 7 * 86400_000).toISOString()
      await store.createInvite({ groupId, tokenHash: hashToken(token), expiresAt })
      return { token, expiresAt }
    },
    inspectInvite: inspect,
    async joinInvite(user, body) {
      checkFields(body, ['token', 'tag'])
      await limit('join:' + user.id, 15, 15)
      await inspect(body.token)
      let tag
      try { tag = normalizePlayerTag(body.tag) } catch (error) { throw new ApiError(400, error.message) }
      if (user.playerTag && user.playerTag !== tag) throw new ApiError(409, 'Esta conta já está vinculada a outra tag. Para cadastrar outro jogador, crie ou acesse a conta dele pelo convite.')
      const player = await clash.getPlayer(tag)
      return store.joinInvite({ tokenHash: hashToken(body.token), accountId: user.id, player: { tag: player.tag, name: player.name }, now: clock() })
    },
  }
}
