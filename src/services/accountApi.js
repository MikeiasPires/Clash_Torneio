async function request(path, { method = 'POST', body, token, signal } = {}) {
  let response
  try {
    response = await fetch(path, { method, credentials: 'same-origin',
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)].filter(Boolean)),
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) })
  } catch (error) { throw new Error('Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.', { cause: error }) }
  let data
  try { data = await response.json() } catch { throw new Error('O servidor retornou uma resposta inválida.') }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível concluir a operação.')
  return data
}
export const getSession = signal => request('/api/auth?action=me', { method: 'GET', signal })
export const registerAccount = body => request('/api/auth?action=register', { body })
export const loginAccount = body => request('/api/auth?action=login', { body })
export const logoutAccount = () => request('/api/auth?action=logout', { body: {} })
export const updateAccount = body => request('/api/auth?action=profile', { body })
export const promoteAccount = token => request('/api/auth?action=promote', { body: {}, token })
export const inspectInvite = (token, signal) => request('/api/invites?action=inspect', { body: { token }, signal })
export const joinInvite = (token, tag) => request('/api/invites?action=join', { body: { token, tag } })
