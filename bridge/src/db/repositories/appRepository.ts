import { getDb } from '../connection.js'
import type { AppsTable, AppVersionsTable } from '../connection.js'
import crypto from 'crypto'

export type NewApp = Omit<AppsTable, 'id' | 'created_at' | 'updated_at'>
export type NewAppVersion = Omit<AppVersionsTable, 'id' | 'created_at'>

export async function createApp(app: NewApp): Promise<AppsTable> {
  return getDb()
    .insertInto('apps')
    .values(app)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findAppByExternalId(externalId: string): Promise<AppsTable | undefined> {
  return getDb()
    .selectFrom('apps')
    .selectAll()
    .where('external_id', '=', externalId)
    .executeTakeFirst()
}

export async function findAppById(id: string): Promise<AppsTable | undefined> {
  return getDb()
    .selectFrom('apps')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function createAppVersion(version: NewAppVersion): Promise<AppVersionsTable> {
  return getDb()
    .insertInto('app_versions')
    .values(version)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findVersionById(id: string): Promise<AppVersionsTable | undefined> {
  return getDb()
    .selectFrom('app_versions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function findVersionsByAppId(appId: string): Promise<AppVersionsTable[]> {
  return getDb()
    .selectFrom('app_versions')
    .selectAll()
    .where('app_id', '=', appId)
    .orderBy('created_at', 'desc')
    .execute()
}

export async function findLatestApprovedVersion(appId: string): Promise<AppVersionsTable | undefined> {
  const result = await getDb()
    .selectFrom('app_versions')
    .innerJoin('app_submissions', 'app_submissions.version_id', 'app_versions.id')
    .selectAll('app_versions')
    .where('app_versions.app_id', '=', appId)
    .where('app_submissions.status', '=', 'approved')
    .orderBy('app_versions.created_at', 'desc')
    .executeTakeFirst()
  return result
}

export function hashManifest(manifest: unknown): string {
  const canonical = JSON.stringify(manifest, Object.keys(manifest as object).sort())
  return crypto.createHash('sha256').update(canonical).digest('hex')
}
