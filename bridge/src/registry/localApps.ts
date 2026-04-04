import type { ChatBridgeAppManifest } from '../../../packages/app-sdk/src'

export const localAppManifests: ChatBridgeAppManifest[] = [
  {
    id: 'chess',
    version: '0.1.0',
    name: 'Chess',
    description: 'Interactive chess app embedded inside the host chat.',
    entryUrl: 'http://localhost:3202',
    origin: 'http://localhost:3202',
    permissions: ['session:write'],
    scopes: [],
    tools: [
      {
        name: 'launch_chess',
        description: 'Launch an interactive chess game where the user plays as white against an AI opponent.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_board_state',
        description: 'Get the current chess board state including position (FEN), move history, whose turn it is, and whether the game is in check/checkmate/stalemate. Use this when the user asks about the current position, wants move suggestions, or asks about game status.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  },
  {
    id: 'weather',
    version: '0.1.0',
    name: 'Weather',
    description: 'Public weather app with no user OAuth requirement.',
    entryUrl: 'http://localhost:3203',
    origin: 'http://localhost:3203',
    permissions: ['session:write'],
    scopes: [],
    tools: [
      {
        name: 'get_weather',
        description: 'Show current weather conditions and a 5-day forecast for a given location.',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: "City name or location, e.g. 'San Francisco', 'Tokyo', 'London'."
            }
          },
          required: ['location']
        }
      }
    ]
  },
  {
    id: 'spotify',
    version: '0.1.0',
    name: 'Spotify',
    description: 'OAuth-backed media app used to prove per-app auth flows.',
    entryUrl: 'http://localhost:3204',
    origin: 'http://localhost:3204',
    permissions: ['session:write', 'auth:oauth'],
    scopes: ['playlist-read-private', 'playlist-modify-private', 'user-read-email'],
    tools: [
      {
        name: 'launch_spotify',
        description: "Show the user's Spotify playlists. Requires Spotify authorization.",
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'create_spotify_playlist',
        description: 'Create a new Spotify playlist for the user.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name for the new playlist.'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'search_spotify',
        description: 'Search for songs on Spotify.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: "The search query, e.g. 'bohemian rhapsody', 'chill lo-fi'."
            }
          },
          required: ['query']
        }
      }
    ]
  }
]
