import 'dotenv/config'
import { initDb, destroyDb, getDb } from './connection.js'
import { sql } from 'kysely'

const SEED_APPS = [
  {
    external_id: 'mock-app',
    display_name: 'Quiz Mock App',
    vendor_name: 'ChatBridge Dev Team',
    category: 'education',
    manifest: {
      id: 'mock-app',
      version: '1.0.0',
      name: 'Quiz Mock App',
      description: 'A quiz app for testing the bridge pipeline',
      entryUrl: 'http://localhost:3201',
      origin: 'http://localhost:3201',
      permissions: [],
      scopes: [],
      tools: [{ name: 'launch_quiz', description: 'Launch a quiz on a given topic', inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'The quiz topic, e.g. Geography, Science, History' } }, required: ['topic'] } }],
    },
  },
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
      entryUrl: 'http://localhost:3202',
      origin: 'http://localhost:3202',
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
      entryUrl: 'http://localhost:3203',
      origin: 'http://localhost:3203',
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
      entryUrl: 'http://localhost:3204',
      origin: 'http://localhost:3204',
      permissions: [],
      scopes: ['playlist-read-private', 'playlist-modify-private', 'user-read-email'],
      tools: [
            { name: 'launch_spotify', description: "Show the user's Spotify playlists. Requires Spotify authorization.", inputSchema: { type: 'object', properties: {}, required: [] } },
            { name: 'create_spotify_playlist', description: 'Create a new Spotify playlist for the user.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'The name for the new playlist.' } }, required: ['name'] } },
            { name: 'search_spotify', description: 'Search for songs on Spotify.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'The search query.' } }, required: ['query'] } },
          ],
    },
  },
]

async function seed() {
  const db = initDb()
  console.log('[seed] Connected to database')

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
