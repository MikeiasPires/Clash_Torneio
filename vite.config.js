import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import { createClashHandler } from './server/clashHandler.mjs'
import { createCardImageHandler } from './server/cardImages.mjs'
import { createGroupsHandler, createMonitorHandler } from './server/groups/handler.mjs'
import { startLocalMonitor } from './server/groups/monitor.mjs'
import { createAuthHandler, createAvatarHandler, createInvitesHandler } from './server/accounts/handler.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Essas variáveis são lidas apenas pelo servidor do Vite, sem prefixo VITE_.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const handlers = {
    '/api/card-image': createCardImageHandler(),
    '/api/player': createClashHandler('player', { env }),
    '/api/battles': createClashHandler('battles', { env }),
    '/api/groups': createGroupsHandler({ env }),
    '/api/monitor': createMonitorHandler({ env }),
    '/api/auth': createAuthHandler({ env }),
    '/api/invites': createInvitesHandler({ env }),
    '/api/avatar': createAvatarHandler({ env }),
  }
  function apiMiddleware(server) {
    const stopMonitor = startLocalMonitor(env, { onError: message => server.config.logger.warn(message) })
    server.httpServer?.once('close', stopMonitor)
    server.middlewares.use((req, res, next) => {
      let path
      try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\\/g, '/') }
      catch { res.statusCode = 400; res.end(); return }
      if (/(?:^|\/)(?:data|server|supabase|scripts)(?:\/|$)|(?:^|\/)\.env[^/]*|\.sqlite(?:[-./?]|$)/i.test(path)) {
        res.statusCode = 404; res.end(); return
      }
      if (handlers[path]) return handlers[path](req, res)
      if (path === '/api' || path.startsWith('/api/')) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Rota não encontrada.' }))
        return
      }
      next()
    })
  }
  return {
    plugins: [react(), { name: 'clash-api-local', configureServer: apiMiddleware, configurePreviewServer: apiMiddleware }],
    optimizeDeps: { include: ['react-router'] },
    server: { headers: { 'Referrer-Policy': 'no-referrer' }, fs: { deny: [
      '.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.[eE][nN][vV]*',
      '**/[dD][aA][tT][aA]/**', '**/*.[sS][qQ][lL][iI][tT][eE]*', '**/server/**', '**/supabase/**', '**/scripts/**',
    ] } },
  }
})
