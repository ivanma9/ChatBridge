import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('tool_executions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('app_id', 'uuid', (col) => col.notNull())
    .addColumn('session_id', 'varchar(255)')
    .addColumn('tool_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('args', 'jsonb')
    .addColumn('status', 'varchar(20)', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('executed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_tool_executions_app')
    .on('tool_executions')
    .columns(['app_id', 'executed_at'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('tool_executions').ifExists().execute()
}
