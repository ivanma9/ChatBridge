import { Router } from 'express'
import { AppAuthBroker } from './AppAuthBroker'
import { bridgeClientAuth } from '../admin/authMiddleware.js'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export function createSpotifyRouter(broker: AppAuthBroker): Router {
  const router = Router()

  // -- Auth endpoints -----------------------------------------------

  // Returns the Spotify authorization URL for the host to open in a popup.
  router.post('/auth/spotify/start', bridgeClientAuth, (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const url = broker.beginOAuth('spotify', clientId)
      res.json({ url })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // OAuth callback — Spotify redirects here after user authorizes
  router.get('/auth/spotify/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>

    if (error) {
      if (state) broker.handleCallbackError(error, state)
      res.send(callbackHtml('error', error))
      return
    }

    if (!code || !state) {
      res.status(400).send(callbackHtml('error', 'Missing code or state parameter'))
      return
    }

    try {
      await broker.handleCallback(code, state)
      res.send(callbackHtml('success', 'Connected to Spotify!'))
    } catch (err) {
      res.send(callbackHtml('error', (err as Error).message))
    }
  })

  // Returns current auth state (for polling)
  router.get('/auth/spotify/status', bridgeClientAuth, (req, res) => {
    const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
    const snapshot = broker.getSnapshot('spotify', clientId)
    if (!snapshot) {
      res.json({ status: 'disconnected', scopes: [] })
      return
    }
    res.json({ status: snapshot.state, scopes: snapshot.grantedScopes })
  })

  // Disconnect — clears tokens and resets state
  router.post('/auth/spotify/disconnect', bridgeClientAuth, (req, res) => {
    const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
    broker.disconnect('spotify', clientId)
    res.json({ status: 'disconnected' })
  })

  // -- Spotify API proxy endpoints ----------------------------------

  // GET /api/spotify/playlists — user's playlists
  router.get('/api/spotify/playlists', bridgeClientAuth, async (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const token = await broker.getValidAccessToken('spotify', clientId)
      const response = await fetch(`${SPOTIFY_API_BASE}/me/playlists?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[spotify] API error ${response.status}:`, errBody)
        res.status(response.status).json({ error: 'Spotify API error: ' + response.status, details: errBody })
        return
      }

      const data = await response.json()
      res.json(data)
    } catch (err) {
      handleProxyError(res, err as Error)
    }
  })

  // POST /api/spotify/playlists — create a new playlist
  router.post('/api/spotify/playlists', bridgeClientAuth, async (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const token = await broker.getValidAccessToken('spotify', clientId)
      const { name, description, public: isPublic } = req.body

      if (!name) {
        res.status(400).json({ error: 'Playlist name is required' })
        return
      }

      const response = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description: description || '',
          public: isPublic ?? false
        })
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[spotify] API error ${response.status}:`, errBody)
        res.status(response.status).json({ error: 'Spotify API error: ' + response.status, details: errBody })
        return
      }

      const data = await response.json()
      res.json(data)
    } catch (err) {
      handleProxyError(res, err as Error)
    }
  })

  // GET /api/spotify/playlists/:id/tracks — tracks in a playlist
  router.get('/api/spotify/playlists/:id/tracks', bridgeClientAuth, async (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const token = await broker.getValidAccessToken('spotify', clientId)
      const { id } = req.params
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 50)
      const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0)

      const response = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${id}/tracks?limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[spotify] API error ${response.status}:`, errBody)
        res.status(response.status).json({ error: 'Spotify API error: ' + response.status, details: errBody })
        return
      }

      const data = await response.json()
      res.json(data)
    } catch (err) {
      handleProxyError(res, err as Error)
    }
  })

  // GET /api/spotify/search — search tracks
  router.get('/api/spotify/search', bridgeClientAuth, async (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const token = await broker.getValidAccessToken('spotify', clientId)
      const q = req.query.q as string
      const type = (req.query.type as string) || 'track'
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 10)

      if (!q) {
        res.status(400).json({ error: 'Search query (q) is required' })
        return
      }

      const params = new URLSearchParams({ q, type, limit: String(limit) })
      const response = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[spotify] API error ${response.status}:`, errBody)
        res.status(response.status).json({ error: 'Spotify API error: ' + response.status, details: errBody })
        return
      }

      const data = await response.json()
      res.json(data)
    } catch (err) {
      handleProxyError(res, err as Error)
    }
  })

  // GET /api/spotify/me — user profile
  router.get('/api/spotify/me', bridgeClientAuth, async (req, res) => {
    try {
      const clientId = (req as typeof req & { bridgeClientId: string }).bridgeClientId
      const token = await broker.getValidAccessToken('spotify', clientId)
      const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[spotify] API error ${response.status}:`, errBody)
        res.status(response.status).json({ error: 'Spotify API error: ' + response.status, details: errBody })
        return
      }

      const data = await response.json()
      res.json(data)
    } catch (err) {
      handleProxyError(res, err as Error)
    }
  })

  return router
}

function handleProxyError(res: any, err: Error): void {
  const message = err.message
  if (message.includes('No token') || message.includes('refresh failed')) {
    res.status(401).json({ error: message })
  } else {
    res.status(502).json({ error: message })
  }
}

// Self-closing HTML page returned to the OAuth popup
function callbackHtml(status: 'success' | 'error', message: string): string {
  const color = status === 'success' ? '#1DB954' : '#ef4444'
  const icon = status === 'success' ? '\u2705' : '\u274C'

  return `<!doctype html>
<html>
<head><title>Spotify Authorization</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa;">
  <div style="text-align: center; padding: 32px;">
    <div style="font-size: 3rem; margin-bottom: 16px;">${icon}</div>
    <div style="font-size: 1.1rem; font-weight: 600; color: ${color}; margin-bottom: 8px;">
      ${status === 'success' ? 'Authorization Successful' : 'Authorization Failed'}
    </div>
    <div style="font-size: 0.9rem; color: #6b7280;">${escapeHtml(message)}</div>
    <div style="font-size: 0.85rem; color: #9ca3af; margin-top: 16px;">This window will close automatically...</div>
  </div>
  <script>
    setTimeout(function() { window.close(); }, 1500);
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
