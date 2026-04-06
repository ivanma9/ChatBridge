import 'dotenv/config'
import { initDb, destroyDb, getDb } from './connection.js'
import { sql } from 'kysely'

const APP_URLS: Record<string, { entryUrl: string; origin: string }> = {
  chess: {
    entryUrl: process.env.CHESS_APP_URL || 'https://chess-lac-beta.vercel.app',
    origin: process.env.CHESS_APP_URL || 'https://chess-lac-beta.vercel.app',
  },
  weather: {
    entryUrl: process.env.WEATHER_APP_URL || 'https://weather-app-one-ecru-12.vercel.app',
    origin: process.env.WEATHER_APP_URL || 'https://weather-app-one-ecru-12.vercel.app',
  },
  spotify: {
    entryUrl: process.env.SPOTIFY_APP_URL || 'https://spotify-zeta-green.vercel.app',
    origin: process.env.SPOTIFY_APP_URL || 'https://spotify-zeta-green.vercel.app',
  },
  'arts-culture': {
    entryUrl: process.env.ARTS_CULTURE_APP_URL || 'https://googleartcult.vercel.app',
    origin: process.env.ARTS_CULTURE_APP_URL || 'https://googleartcult.vercel.app',
  },
}

const SEED_APPS = [
  {
    external_id: 'chess',
    display_name: 'Chess',
    vendor_name: 'ChatBridge Dev Team',
    category: 'education',
    manifest: {
      id: 'chess',
      version: '1.0.0',
      name: 'Chess',
      description: 'Play chess within the chat',
      entryUrl: APP_URLS.chess.entryUrl,
      origin: APP_URLS.chess.origin,
      permissions: [],
      scopes: [],
      tools: [
        { name: 'launch_chess', description: 'Launch an interactive chess game where the user plays as white against an AI opponent.', inputSchema: { type: 'object', properties: {}, required: [] } },
        { name: 'get_board_state', description: 'Get the current chess board state including position (FEN), move history, whose turn it is, and whether the game is in check/checkmate/stalemate. Use this when the user asks about the current position, wants move suggestions, or asks about game status.', inputSchema: { type: 'object', properties: {}, required: [] } },
      ],
    },
  },
  {
    external_id: 'weather',
    display_name: 'Weather',
    vendor_name: 'ChatBridge Dev Team',
    category: 'productivity',
    manifest: {
      id: 'weather',
      version: '1.0.0',
      name: 'Weather',
      description: 'Check current weather conditions',
      entryUrl: APP_URLS.weather.entryUrl,
      origin: APP_URLS.weather.origin,
      permissions: ['geolocation'],
      scopes: [],
      tools: [{ name: 'weather_check', description: 'Check weather for a location', inputSchema: { type: 'object', properties: { location: { type: 'string' } } } }],
    },
  },
  {
    external_id: 'spotify',
    display_name: 'Spotify',
    vendor_name: 'Spotify AB',
    category: 'entertainment',
    manifest: {
      id: 'spotify',
      version: '1.0.0',
      name: 'Spotify',
      description: 'Browse and play music from Spotify',
      entryUrl: APP_URLS.spotify.entryUrl,
      origin: APP_URLS.spotify.origin,
      permissions: [],
      scopes: ['playlist-read-private', 'playlist-modify-private', 'user-read-email'],
      tools: [
            { name: 'launch_spotify', description: "Show the user's Spotify playlists. Requires Spotify authorization.", inputSchema: { type: 'object', properties: {}, required: [] } },
            { name: 'create_spotify_playlist', description: 'Create a new Spotify playlist for the user.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'The name for the new playlist.' } }, required: ['name'] } },
            { name: 'search_spotify', description: 'Search for songs on Spotify.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'The search query.' } }, required: ['query'] } },
          ],
    },
  },
  {
    external_id: 'arts-culture',
    display_name: 'Arts & Culture',
    vendor_name: 'ChatBridge Dev Team',
    category: 'education',
    manifest: {
      id: 'arts-culture',
      version: '0.1.0',
      name: 'Arts & Culture',
      description: 'Browse public domain artworks from the Art Institute of Chicago.',
      entryUrl: APP_URLS['arts-culture'].entryUrl,
      origin: APP_URLS['arts-culture'].origin,
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
    },
  },
]

async function seed() {
  const db = initDb()
  console.log('[seed] Connected to database')

  // Clear existing data for a clean reseed
  await sql`TRUNCATE registry_entries, review_decisions, app_sessions, app_submissions, app_versions, apps CASCADE`.execute(db)
  console.log('[seed] Cleared existing data')

  for (const app of SEED_APPS) {
    // Check if app already exists
    const existing = await db
      .selectFrom('apps')
      .select('id')
      .where('external_id', '=', app.external_id)
      .executeTakeFirst()

    if (existing) {
      console.log(`[seed] App "${app.external_id}" already exists, skipping`)
      continue
    }

    // Create app
    const appRow = await db
      .insertInto('apps')
      .values({
        external_id: app.external_id,
        display_name: app.display_name,
        vendor_name: app.vendor_name,
        category: app.category,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create version
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(JSON.stringify(app.manifest)).digest('hex')

    const version = await db
      .insertInto('app_versions')
      .values({
        app_id: appRow.id,
        version_identifier: app.manifest.version,
        manifest: JSON.stringify(app.manifest),
        manifest_hash: hash,
        created_by: 'seed',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create submission (approved)
    const submission = await db
      .insertInto('app_submissions')
      .values({
        version_id: version.id,
        app_id: appRow.id,
        status: 'approved' as any,
        risk_level: 'low' as any,
        is_update: false,
        submitted_by: 'seed',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create review decision
    await db
      .insertInto('review_decisions')
      .values({
        submission_id: submission.id,
        decision: 'approved',
        rationale: 'Pre-approved seed data for development',
        reviewer_id: 'seed',
        findings_considered: sql`'{}'::uuid[]`,
      } as any)
      .execute()

    // Create registry entry
    await db
      .insertInto('registry_entries')
      .values({
        app_id: appRow.id,
        version_id: version.id,
        display_name: app.manifest.name,
        display_description: app.manifest.description,
        display_category: app.category,
        tool_schemas: JSON.stringify(app.manifest.tools),
        entry_url: app.manifest.entryUrl,
        allowed_origin: app.manifest.origin,
      })
      .execute()

    console.log(`[seed] App "${app.external_id}" created and approved`)
  }

  await destroyDb()
  console.log('[seed] Seeding complete')
}

seed().catch((err) => {
  console.error('[seed] Error:', err)
  process.exit(1)
})
