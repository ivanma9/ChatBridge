import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

export interface Database {
  apps: AppsTable
  app_versions: AppVersionsTable
  app_submissions: AppSubmissionsTable
  review_findings: ReviewFindingsTable
  review_decisions: ReviewDecisionsTable
  registry_entries: RegistryEntriesTable
  app_sessions: AppSessionsTable
}

export interface AppsTable {
  id: string
  external_id: string
  display_name: string
  vendor_name: string
  category: string | null
  created_at: Date
  updated_at: Date
}

export interface AppVersionsTable {
  id: string
  app_id: string
  version_identifier: string
  manifest: unknown
  manifest_hash: string
  created_at: Date
  created_by: string
}

export interface AppSubmissionsTable {
  id: string
  version_id: string
  app_id: string
  status: string
  risk_level: string | null
  is_update: boolean
  prior_approved_version_id: string | null
  diff_result: unknown | null
  submitted_at: Date
  submitted_by: string
  checks_started_at: Date | null
  checks_completed_at: Date | null
  review_completed_at: Date | null
}

export interface ReviewFindingsTable {
  id: string
  submission_id: string
  source: string
  check_name: string
  finding_type: string
  severity: string
  title: string
  description: string
  change_context: string | null
  affected_path: string | null
  created_at: Date
  created_by: string
}

export interface ReviewDecisionsTable {
  id: string
  submission_id: string
  decision: string
  rationale: string
  reviewer_id: string
  findings_considered: string[]
  decided_at: Date
}

export interface RegistryEntriesTable {
  app_id: string
  version_id: string
  display_name: string
  display_description: string | null
  display_category: string | null
  tool_schemas: unknown
  entry_url: string
  allowed_origin: string
  activated_at: Date
}

export interface AppSessionsTable {
  id: string
  client_id: string
  chat_session_id: string
  app_id: string
  pinned_version_id: string
  state: unknown | null
  created_at: Date
  updated_at: Date
}

let db: Kysely<Database> | null = null

export function getDb(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

export function initDb(connectionString?: string): Kysely<Database> {
  const connStr = connectionString || process.env.DATABASE_URL
  if (!connStr) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: connStr,
        max: 10,
      }),
    }),
  })

  return db
}

export async function destroyDb(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
}
