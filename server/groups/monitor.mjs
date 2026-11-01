import { POLL_INTERVAL_MS } from './domain.mjs'
import { getGroupsService } from './service.mjs'

export function startLocalMonitor(env, { onError = () => {}, getService = () => getGroupsService(env) } = {}) {
  if (env.VERCEL || env.X1_MONITOR_ENABLED === 'false') return () => {}
  let stopped = false, running = false
  async function tick() {
    if (stopped || running) return
    running = true
    try { await (await getService()).sync() }
    catch { onError('Monitor de x1: não foi possível consultar ou salvar o último lote.') }
    finally { running = false }
  }
  const timer = setInterval(tick, POLL_INTERVAL_MS)
  timer.unref()
  void tick()
  return () => { stopped = true; clearInterval(timer) }
}
