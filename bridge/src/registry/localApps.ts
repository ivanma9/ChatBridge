import type { ChatBridgeAppManifest } from '../../../packages/app-sdk/src'

export const localAppManifests: ChatBridgeAppManifest[] = [
  {
    id: 'chess',
    version: '0.1.0',
    name: 'Chess',
    description: 'Interactive chess app embedded inside the host chat.',
    entryUrl: process.env.CHESS_APP_URL || 'http://localhost:3202',
    origin: process.env.CHESS_APP_URL || 'http://localhost:3202',
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
  },
  {
    id: 'arts-culture',
    version: '0.1.0',
    name: 'Arts & Culture',
    description: 'Browse public domain artworks from the Art Institute of Chicago.',
    entryUrl: process.env.ARTS_CULTURE_APP_URL || 'https://googleartcult.vercel.app',
    origin: process.env.ARTS_CULTURE_APP_URL || 'https://googleartcult.vercel.app',
    permissions: ['session:write'],
    scopes: [],
    tools: [
      {
        name: 'launch_arts_culture',
        description: 'Open the Arts & Culture explorer to browse public domain artworks from the Art Institute of Chicago.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'search_artworks',
        description: 'Search for public domain artworks in the Art Institute of Chicago collection. All parameters are optional — combine freely.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: "Keyword search, e.g. 'landscape', 'portrait', 'battle'" },
            date_start: { type: 'number', description: 'Earliest creation year, e.g. 1800' },
            date_end: { type: 'number', description: 'Latest creation year, e.g. 1899' },
            medium: { type: 'string', description: "Medium or technique, e.g. 'oil on canvas', 'watercolor', 'bronze'" },
            classification: { type: 'string', description: "Artwork type, e.g. 'Painting', 'Sculpture', 'Drawing and Watercolor', 'Photograph'" },
            place_of_origin: { type: 'string', description: "Country or region where the work was made, e.g. 'France', 'Japan', 'United States'" },
            artist: { type: 'string', description: "Artist name, e.g. 'Monet', 'Rembrandt', 'Georgia O\u2019Keeffe'" },
            department: { type: 'string', description: "Museum department, e.g. 'Impressionism', 'Photography', 'American Art', 'Asian Art'" },
            style: { type: 'string', description: "Art style or movement, e.g. 'Impressionism', 'Baroque', 'Abstract Expressionism'" },
          },
          required: [],
        },
      },
    ],
  }
]
