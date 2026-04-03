import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('app_sessions')
    .addColumn('client_id', 'varchar(255)', (col) => col.notNull().defaultTo('legacy-client'))
    .execute()

  await db.schema.dropIndex('idx_sessions_chat_app').ifExists().execute()

  await db.schema
    .createIndex('idx_sessions_client_chat_app')
    .on('app_sessions')
    .columns(['client_id', 'chat_session_id', 'app_id'])
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_sessions_client_chat_app').ifExists().execute()

  await db.schema
    .createIndex('idx_sessions_chat_app')
    .on('app_sessions')
    .columns(['chat_session_id', 'app_id'])
    .unique()
    .execute()

  await db.schema.alterTable('app_sessions').dropColumn('client_id').execute()
}
