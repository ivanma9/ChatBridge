import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './db/connection.js'
import { adminAuth, bridgeClientAuth } from './admin/authMiddleware.js'
import { submissionRouter } from './admin/submissionRoutes.js'
import { decisionRouter } from './admin/decisionRoutes.js'
import { registryRouter } from './admin/registryRoutes.js'
import { historyRouter } from './admin/historyRoutes.js'
import { appProxyRouter } from './admin/appProxyRoutes.js'
import { createBridgeClientSession, isValidClientId } from './auth/BridgeClientSession.js'
import { createSpotifyRouter } from './auth/OAuthCallbackServer.js'
import { spotifyAuthBroker } from './auth/spotifyBroker.js'
import { createBridgeCorsOptions } from './http/cors.js'

const PORT = parseInt(process.env.PORT || '3300', 10)
const ENABLE_APP_PROXY_DEV = process.env.ENABLE_APP_PROXY_DEV === 'true'

const app = express()
app.use(cors(createBridgeCorsOptions()))
app.use(express.json())
app.use((req, _res, next) => {
  console.log(`[bridge] ${req.method} ${req.path} origin=${req.headers.origin || '-'} auth=${req.headers.authorization ? req.headers.authorization.slice(0, 20) + '…' : 'none'}`)
  next()
})

// Initialize database
let dbReady = false
try {
  initDb()
  dbReady = true
  console.log('[bridge] Database connection initialized')
} catch (err) {
  console.warn('[bridge] Database not configured — review features disabled.', (err as Error).message)
}

// Admin UI (static files)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.use('/admin', express.static(path.join(__dirname, 'admin', 'public')))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: dbReady })
})

app.post('/api/bridge/session', (req, res) => {
  const clientId = isValidClientId(req.body?.client_id) ? req.body.client_id : undefined
  const session = createBridgeClientSession(clientId)
  res.json(session)
})

// Spotify OAuth & API proxy
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET
if (spotifyClientId && spotifyClientSecret) {
  spotifyAuthBroker.configureOAuth({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/auth/spotify/callback`,
    authorizationUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['playlist-read-private', 'playlist-modify-private', 'user-read-email']
  })
  app.use(createSpotifyRouter(spotifyAuthBroker))
  console.log('[bridge] Spotify OAuth routes enabled')
} else {
  console.warn('[bridge] Spotify OAuth disabled — missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET')
}

// Generic tool mediation — any app's tool requests go through here
import { executeToolRequest } from './orchestration/ToolMediator.js'
import './orchestration/handlers/authHandler.js' // register built-in handlers
import './orchestration/handlers/spotifyHandler.js'

app.post('/api/tools/execute', bridgeClientAuth, async (req, res) => {
  try {
    const { app_id, tool_name, args, session_id } = req.body
    if (!app_id || !tool_name) {
      res.status(400).json({ error: 'app_id and tool_name are required' })
      return
    }
    const client_id = (req as typeof req & { bridgeClientId: string }).bridgeClientId
    const result = await executeToolRequest({ app_id, tool_name, args: args || {}, session_id, client_id })
    res.json(result)
  } catch (err) {
    console.error('[tools] Execute error:', err)
    res.status(500).json({ error: 'Tool execution failed' })
  }
})

// Keep legacy endpoint for backwards compatibility
app.post('/api/app-tool/:toolName', bridgeClientAuth, async (req, res) => {
  const { app_id, args, session_id } = req.body
  const client_id = (req as typeof req & { bridgeClientId: string }).bridgeClientId
  const result = await executeToolRequest({ app_id, tool_name: req.params.toolName, args: args || {}, session_id, client_id })
  res.json(result)
})

// Review & registry routes (require DB)
if (dbReady) {
  app.use('/api/admin/submissions', adminAuth, submissionRouter)
  app.use('/api/admin', adminAuth, decisionRouter)
  app.use('/api/admin/apps', adminAuth, historyRouter)
  app.use('/api/registry', registryRouter)
  app.use('/api', registryRouter)

  if (ENABLE_APP_PROXY_DEV) {
    app.use('/apps', appProxyRouter)

    // Start app proxy on separate port only for explicit local development use.
    import('./appProxyServer.js').then(({ startAppProxyServer }) => {
      startAppProxyServer()
    })
  }
}

app.listen(PORT, () => {
  console.log(`[bridge] Server running on port ${PORT}`)
  if (dbReady) {
    console.log(`[bridge] Admin API: http://localhost:${PORT}/api/admin/`)
    console.log(`[bridge] Registry API: http://localhost:${PORT}/api/registry/active`)
    console.log(`[bridge] Admin UI: http://localhost:${PORT}/admin`)
  }
})
