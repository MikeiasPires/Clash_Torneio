async function request(query = '', { method = 'GET', body, token, signal } = {}) {
  let response
  try {
    response = await fetch(`/api/groups${query}`, {
      method, signal: AbortSignal.any([signal, AbortSignal.timeout(method === 'GET' ? 15_000 : 70_000)].filter(Boolean)),
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Não foi possível acessar o registrador de x1. Verifique a conexão e tente novamente.', { cause: error })
  }
  let data
  try { data = await response.json() } catch { throw new Error('O servidor não retornou uma resposta válida. Reinicie o aplicativo.') }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível concluir a operação.')
  return data
}

export const listGroups = signal => request('', { signal })
export const getGroup = (id, offset, signal) => request(`?${new URLSearchParams({ id, offset: String(offset) })}`, { signal })
export const createGroup = (body, token, signal) => request('?action=create', { method: 'POST', body, token, signal })
export const syncGroup = (id, token, signal) => request(`?${new URLSearchParams({ action: 'sync', id })}`, { method: 'POST', body: {}, token, signal })
export const pollGroup = (id, signal) => request(`?${new URLSearchParams({ action: 'poll', id })}`, { method: 'POST', body: {}, signal })
export const toggleGroup = (id, enabled, token, signal) => request(`?${new URLSearchParams({ action: 'toggle', id })}`, { method: 'POST', body: { enabled }, token, signal })
export const addGroupMembers = (id, tags, token, signal) => request(`?${new URLSearchParams({ action: 'add-members', id })}`, { method: 'POST', body: { tags }, token, signal })
export const removeGroupMember = (id, tag, token, signal) => request(`?${new URLSearchParams({ action: 'remove-member', id })}`, { method: 'POST', body: { tag }, token, signal })
export const deleteGroup = (id, token, signal) => request(`?${new URLSearchParams({ action: 'delete', id })}`, { method: 'POST', body: { confirm: true }, token, signal })
export const createGroupInvite = (id, token, signal) => request(`?${new URLSearchParams({ action: 'invite', id })}`, { method: 'POST', body: {}, token, signal })
export const revokeGroupInvite = (id, token, signal) => request(`?${new URLSearchParams({ action: 'revoke-invite', id })}`, { method: 'POST', body: {}, token, signal })
