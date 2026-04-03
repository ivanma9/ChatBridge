import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('app_sessions')
    .addColumn('state', 'jsonb')
    .execute()

  await db.schema
    .alterTable('app_sessions')
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('app_sessions').dropColumn('state').execute()
  await db.schema.alterTable('app_sessions').dropColumn('updated_at').execute()
}
