import { getDb } from '../connection.js'
import type { RegistryEntriesTable, AppSessionsTable } from '../connection.js'

export type NewRegistryEntry = Omit<RegistryEntriesTable, 'activated_at'>

export async function upsertRegistryEntry(entry: NewRegistryEntry): Promise<RegistryEntriesTable> {
  return getDb()
    .insertInto('registry_entries')
    .values(entry)
    .onConflict((oc) =>
      oc.column('app_id').doUpdateSet({
        version_id: entry.version_id,
        display_name: entry.display_name,
        display_description: entry.display_description,
        display_category: entry.display_category,
        tool_schemas: entry.tool_schemas as any,
        entry_url: entry.entry_url,
        allowed_origin: entry.allowed_origin,
        activated_at: new Date() as any,
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteRegistryEntry(appId: string): Promise<boolean> {
  const result = await getDb()
    .deleteFrom('registry_entries')
    .where('app_id', '=', appId)
    .executeTakeFirst()
  return (result?.numDeletedRows ?? 0n) > 0n
}

export async function findRegistryEntry(appId: string): Promise<RegistryEntriesTable | undefined> {
  return getDb()
    .selectFrom('registry_entries')
    .selectAll()
    .where('app_id', '=', appId)
    .executeTakeFirst()
}

export async function listActiveRegistry(): Promise<RegistryEntriesTable[]> {
  return getDb()
    .selectFrom('registry_entries')
    .selectAll()
    .orderBy('display_name', 'asc')
    .execute()
}

// Session pinning

export async function createAppSession(session: Omit<AppSessionsTable, 'id' | 'created_at'>): Promise<AppSessionsTable> {
  return getDb()
    .insertInto('app_sessions')
    .values(session)
    .onConflict((oc) =>
      oc.columns(['chat_session_id', 'app_id']).doNothing()
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findAppSession(sessionId: string): Promise<AppSessionsTable | undefined> {
  return getDb()
    .selectFrom('app_sessions')
    .selectAll()
    .where('id', '=', sessionId)
    .executeTakeFirst()
}

export async function findAppSessionByChatAndApp(chatSessionId: string, appId: string): Promise<AppSessionsTable | undefined> {
  return getDb()
    .selectFrom('app_sessions')
    .selectAll()
    .where('chat_session_id', '=', chatSessionId)
    .where('app_id', '=', appId)
    .executeTakeFirst()
}
