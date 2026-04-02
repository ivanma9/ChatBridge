import type { ChatBridgeAppManifest } from '../../../packages/app-sdk/src'

export const localAppManifests: ChatBridgeAppManifest[] = [
  {
    id: 'mock-app',
    version: '0.2.0',
    name: 'Quick Quiz',
    description: 'A 3-question quiz that exercises every ChatBridge contract point: manifest loading, iframe hosting, postMessage handshakes, state save/resume, and completion signaling.',
    entryUrl: 'http://localhost:3201',
    origin: 'http://localhost:3201',
    permissions: ['session:write'],
    scopes: [],
    tools: [
      {
        name: 'launch_quiz',
        description: 'Launch a 3-question multiple-choice quiz on a given topic.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: "The quiz topic, e.g. 'Geography', 'Science', 'History'."
            }
          },
          required: ['topic']
        }
      }
    ]
  },
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
    scopes: ['playlist-read-private', 'user-read-email'],
    tools: [
      {
        name: 'launch_spotify',
        description: "Show the user's Spotify playlists. Requires Spotify authorization.",
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  }
]
