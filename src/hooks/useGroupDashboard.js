import { useCallback, useEffect, useState } from 'react'
import { getGroup, listGroups } from '../services/groupsApi.js'
import { startGroupPolling } from '../services/groupPolling.js'
import { GROUP_POLL_INTERVAL_MS } from '../../shared/groupTiming.js'

function initialGroup() {
  if (typeof window === 'undefined') return ''
  try { return new URLSearchParams(window.location.search).get('grupo') || localStorage.getItem('x1:group') || '' }
  catch { return '' }
}

export function useGroupDashboard({ autoSync = true } = {}) {
  const [groupId, setGroupId] = useState(initialGroup)
  const [offset, setOffset] = useState(0)
  const [version, setVersion] = useState(0)
  const [catalog, setCatalog] = useState(null)
  const [state, setState] = useState({ key: '', id: '', offset: 0, data: null, error: '' })
  const [collection, setCollection] = useState({ id: '', error: '' })
  const refresh = useCallback(() => setVersion(value => value + 1), [])
  const key = `${groupId}:${offset}:${version}`
  const selectedGroup = catalog?.groups.find(group => group.id === groupId)
  const canPoll = Boolean(autoSync && selectedGroup?.enabled && selectedGroup.memberCount >= 2)

  const selectGroup = useCallback(id => {
    setGroupId(id)
    setOffset(0)
    try { localStorage.setItem('x1:group', id) } catch { /* A seleção ainda funciona nesta tela. */ }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    listGroups(controller.signal).then(data => {
      if (controller.signal.aborted) return
      setCatalog({ ...data, error: '' })
      setGroupId(previous => data.groups.some(group => group.id === previous) ? previous : data.groups[0]?.id || '')
    }).catch(error => {
      if (!controller.signal.aborted) setCatalog(previous => ({ ...previous, groups: previous?.groups || [], error: error.message }))
    })
    return () => controller.abort()
  }, [version])

  useEffect(() => {
    if (!groupId) return
    const controller = new AbortController()
    getGroup(groupId, offset, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, id: groupId, offset, data, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ key, id: groupId, offset, data: previous.id === groupId && previous.offset === offset ? previous.data : null, error: error.message }))
    })
    return () => controller.abort()
  }, [groupId, offset, key])

  useEffect(() => {
    if (canPoll) return
    const timer = setInterval(refresh, GROUP_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh, canPoll])

  useEffect(() => {
    if (!canPoll) return
    return startGroupPolling({ groupId,
      onResult(report) {
        if (report.checkedPlayers) setCollection({ id: groupId, error: report.failures.length ? report.failures[0].error : '' })
        refresh()
      },
      onError(error) { setCollection({ id: groupId, error: error.message }); refresh() },
    })
  }, [groupId, canPoll, refresh])

  return {
    forgetGroup(id) {
      const remaining = (catalog?.groups || []).filter(group => group.id !== id)
      setCatalog(previous => ({ ...previous, groups: remaining }))
      selectGroup(remaining[0]?.id || '')
    },
    groups: catalog?.groups || [], localOrganizer: Boolean(catalog?.localOrganizer),
    groupId, selectGroup, snapshot: state.id === groupId && state.offset === offset ? state.data : null,
    loading: !catalog || Boolean(groupId && state.key !== key),
    error: catalog?.error || (state.key === key ? state.error : '') || (canPoll && collection.id === groupId ? collection.error : ''), refresh, offset,
    nextPage: () => setOffset(value => value + 50), previousPage: () => setOffset(value => Math.max(0, value - 50)),
  }
}
