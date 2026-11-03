import { GROUP_POLL_INTERVAL_MS } from '../../shared/groupTiming.js'
import { pollGroup } from './groupsApi.js'

export function startGroupPolling({ groupId, onResult, onError, poll = pollGroup, visibilityTarget = globalThis.document }) {
  const controller = new AbortController()
  let stopped = false, running = false
  async function tick() {
    if (stopped || running || visibilityTarget?.visibilityState === 'hidden') return
    running = true
    try {
      const report = await poll(groupId, controller.signal)
      if (!stopped) onResult(report)
    } catch (error) {
      if (!stopped) onError(error)
    } finally { running = false }
  }
  const update = () => { void tick() }
  const timer = setInterval(update, GROUP_POLL_INTERVAL_MS)
  visibilityTarget?.addEventListener('visibilitychange', update)
  update()
  return () => {
    stopped = true
    controller.abort()
    clearInterval(timer)
    visibilityTarget?.removeEventListener('visibilitychange', update)
  }
}
