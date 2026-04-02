import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create enum types
  await sql`
    CREATE TYPE approval_status AS ENUM (
      'draft', 'pending_checks', 'pending_review',
      'approved', 'rejected', 'suspended', 'superseded'
    )
  `.execute(db)

  await sql`
    CREATE TYPE review_risk_level AS ENUM (
      'low', 'medium', 'high', 'critical'
    )
  `.execute(db)

  // Create apps table
  await db.schema
    .createTable('apps')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('external_id', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('display_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('vendor_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('category', 'varchar(100)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create app_versions table
  await db.schema
    .createTable('app_versions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('app_id', 'uuid', (col) => col.notNull().references('apps.id'))
    .addColumn('version_identifier', 'varchar(100)', (col) => col.notNull())
    .addColumn('manifest', 'jsonb', (col) => col.notNull())
    .addColumn('manifest_hash', 'varchar(64)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'varchar(255)', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('idx_app_versions_app_id_version')
    .on('app_versions')
    .columns(['app_id', 'version_identifier'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_app_versions_app_id_created')
    .on('app_versions')
    .columns(['app_id', 'created_at'])
    .execute()

  // Create app_submissions table
  await sql`
    CREATE TABLE app_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      version_id UUID NOT NULL UNIQUE REFERENCES app_versions(id),
      app_id UUID NOT NULL REFERENCES apps(id),
      status approval_status NOT NULL DEFAULT 'draft',
      risk_level review_risk_level,
      is_update BOOLEAN NOT NULL DEFAULT FALSE,
      prior_approved_version_id UUID REFERENCES app_versions(id),
      diff_result JSONB,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_by VARCHAR(255) NOT NULL,
      checks_started_at TIMESTAMPTZ,
      checks_completed_at TIMESTAMPTZ,
      review_completed_at TIMESTAMPTZ
    )
  `.execute(db)

  await db.schema
    .createIndex('idx_submissions_app_status')
    .on('app_submissions')
    .columns(['app_id', 'status'])
    .execute()

  // Partial unique index: one active review per app
  await sql`
    CREATE UNIQUE INDEX idx_submissions_one_active_per_app
    ON app_submissions (app_id)
    WHERE status IN ('pending_checks', 'pending_review')
  `.execute(db)

  // Create review_findings table
  await db.schema
    .createTable('review_findings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('submission_id', 'uuid', (col) => col.notNull().references('app_submissions.id'))
    .addColumn('source', 'varchar(50)', (col) => col.notNull())
    .addColumn('check_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('finding_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('severity', 'varchar(20)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('change_context', 'varchar(20)')
    .addColumn('affected_path', 'varchar(500)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'varchar(255)', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('idx_findings_submission')
    .on('review_findings')
    .column('submission_id')
    .execute()

  await db.schema
    .createIndex('idx_findings_submission_severity')
    .on('review_findings')
    .columns(['submission_id', 'severity'])
    .execute()

  // Create review_decisions table
  await sql`
    CREATE TABLE review_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID NOT NULL UNIQUE REFERENCES app_submissions(id),
      decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
      rationale TEXT NOT NULL,
      reviewer_id VARCHAR(255) NOT NULL,
      findings_considered UUID[] NOT NULL,
      decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db)

  // Create registry_entries table
  await db.schema
    .createTable('registry_entries')
    .addColumn('app_id', 'uuid', (col) => col.primaryKey().references('apps.id'))
    .addColumn('version_id', 'uuid', (col) => col.notNull().references('app_versions.id'))
    .addColumn('display_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('display_description', 'text')
    .addColumn('display_category', 'varchar(100)')
    .addColumn('tool_schemas', 'jsonb', (col) => col.notNull())
    .addColumn('entry_url', 'varchar(2048)', (col) => col.notNull())
    .addColumn('allowed_origin', 'varchar(2048)', (col) => col.notNull())
    .addColumn('activated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_registry_category')
    .on('registry_entries')
    .column('display_category')
    .execute()

  // Create app_sessions table for session pinning
  await db.schema
    .createTable('app_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('chat_session_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('app_id', 'uuid', (col) => col.notNull().references('apps.id'))
    .addColumn('pinned_version_id', 'uuid', (col) => col.notNull().references('app_versions.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_sessions_chat_app')
    .on('app_sessions')
    .columns(['chat_session_id', 'app_id'])
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('app_sessions').ifExists().execute()
  await db.schema.dropTable('registry_entries').ifExists().execute()
  await db.schema.dropTable('review_decisions').ifExists().execute()
  await db.schema.dropTable('review_findings').ifExists().execute()
  await db.schema.dropTable('app_submissions').ifExists().execute()
  await db.schema.dropTable('app_versions').ifExists().execute()
  await db.schema.dropTable('apps').ifExists().execute()
  await sql`DROP TYPE IF EXISTS review_risk_level`.execute(db)
  await sql`DROP TYPE IF EXISTS approval_status`.execute(db)
}
