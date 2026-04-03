import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './db/connection.js'
import { adminAuth } from './admin/authMiddleware.js'
import { submissionRouter } from './admin/submissionRoutes.js'
import { decisionRouter } from './admin/decisionRoutes.js'
import { registryRouter } from './admin/registryRoutes.js'
import { historyRouter } from './admin/historyRoutes.js'
import { appProxyRouter } from './admin/appProxyRoutes.js'
import { AppAuthBroker } from './auth/AppAuthBroker.js'
import { createSpotifyRouter } from './auth/OAuthCallbackServer.js'

const PORT = parseInt(process.env.PORT || '3300', 10)

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

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

// Spotify OAuth & API proxy
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET
if (spotifyClientId && spotifyClientSecret) {
  const broker = new AppAuthBroker()
  broker.configureOAuth({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/auth/spotify/callback`,
    authorizationUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['playlist-read-private', 'playlist-modify-private', 'user-read-email']
  })
  app.use(createSpotifyRouter(broker))
  console.log('[bridge] Spotify OAuth routes enabled')
} else {
  console.warn('[bridge] Spotify OAuth disabled — missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET')
}

// App tool requests (OAuth, API proxying)
app.post('/api/app-tool/:toolName', express.json(), (req, res) => {
  const { toolName } = req.params
  const { app_id, args } = req.body

  // Spotify auth: return the auth start URL
  if (toolName === 'request_spotify_auth') {
    const authUrl = `http://localhost:${PORT}/auth/spotify/start`
    res.json({ status: 'connecting', scopes: [], authUrl })
    return
  }

  // Default: tool not implemented
  res.status(404).json({ error: `Tool ${toolName} not implemented` })
})

// Review & registry routes (require DB)
if (dbReady) {
  app.use('/api/admin/submissions', adminAuth, submissionRouter)
  app.use('/api/admin', adminAuth, decisionRouter)
  app.use('/api/admin/apps', adminAuth, historyRouter)
  app.use('/api/registry', registryRouter)
  app.use('/api', registryRouter)
  app.use('/apps', appProxyRouter)

  // Start app proxy on separate port (different origin for iframe isolation)
  import('./appProxyServer.js').then(({ startAppProxyServer }) => {
    startAppProxyServer()
  })
}

app.listen(PORT, () => {
  console.log(`[bridge] Server running on port ${PORT}`)
  if (dbReady) {
    console.log(`[bridge] Admin API: http://localhost:${PORT}/api/admin/`)
    console.log(`[bridge] Registry API: http://localhost:${PORT}/api/registry/active`)
    console.log(`[bridge] Admin UI: http://localhost:${PORT}/admin`)
  }
})
