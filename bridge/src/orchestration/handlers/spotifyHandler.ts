import { registerToolHandler } from '../ToolMediator.js'
import type { ToolRequest } from '../ToolMediator.js'
import { spotifyAuthBroker } from '../../auth/spotifyBroker.js'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

async function spotifyFetchForClient(clientId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await spotifyAuthBroker.getValidAccessToken('spotify', clientId)
  const headers = new Headers(init?.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers,
  })
}

async function getSpotifyUserId(clientId: string): Promise<string> {
  const response = await spotifyFetchForClient(clientId, '/me')
  if (!response.ok) {
    throw new Error(`Failed to load Spotify profile (${response.status})`)
  }

  const data = await response.json() as { id?: string }
  if (!data.id) {
    throw new Error('Spotify profile response did not include a user id')
  }

  return data.id
}

registerToolHandler({
  match: (appId: string, toolName: string) => appId === 'spotify' && toolName.startsWith('bridge:spotify:'),
  execute: async (request: ToolRequest) => {
    const { tool_name, args, client_id } = request
    if (!client_id) {
      throw new Error('Spotify bridge tools require a bridge client id')
    }

    switch (tool_name) {
      case 'bridge:spotify:auth-status': {
        const snapshot = spotifyAuthBroker.getSnapshot('spotify', client_id)
        return snapshot
          ? { status: snapshot.state, scopes: snapshot.grantedScopes }
          : { status: 'disconnected', scopes: [] }
      }

      case 'bridge:spotify:list-playlists': {
        const response = await spotifyFetchForClient(client_id, '/me/playlists?limit=50')
        if (!response.ok) {
          throw new Error(`Spotify playlists request failed (${response.status})`)
        }
        return response.json()
      }

      case 'bridge:spotify:get-playlist-tracks': {
        const playlistId = String(args.playlistId || '')
        if (!playlistId) {
          throw new Error('playlistId is required')
        }

        const response = await spotifyFetchForClient(
          client_id,
          `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`
        )
        if (!response.ok) {
          throw new Error(`Spotify tracks request failed (${response.status})`)
        }
        return response.json()
      }

      case 'bridge:spotify:search-tracks': {
        const query = String(args.query || '')
        if (!query) {
          throw new Error('query is required')
        }

        const response = await spotifyFetchForClient(
          client_id,
          `/search?${new URLSearchParams({ q: query, type: 'track', limit: '10' }).toString()}`
        )
        if (!response.ok) {
          throw new Error(`Spotify search request failed (${response.status})`)
        }
        return response.json()
      }

      case 'bridge:spotify:create-playlist': {
        const name = String(args.name || '')
        if (!name) {
          throw new Error('name is required')
        }

        const userId = await getSpotifyUserId(client_id)
        const response = await spotifyFetchForClient(client_id, `/users/${encodeURIComponent(userId)}/playlists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: String(args.description || ''),
            public: Boolean(args.public),
          }),
        })

        if (!response.ok) {
          throw new Error(`Spotify create playlist request failed (${response.status})`)
        }

        return response.json()
      }

      default:
        throw new Error(`Unsupported Spotify bridge tool: ${tool_name}`)
    }
  },
})
