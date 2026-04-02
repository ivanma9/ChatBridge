import { getDb } from '../connection.js'
import type { AppSubmissionsTable } from '../connection.js'
import { sql } from 'kysely'

export type NewAppSubmission = Omit<AppSubmissionsTable, 'id' | 'submitted_at' | 'checks_started_at' | 'checks_completed_at' | 'review_completed_at'>

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_checks'],
  pending_checks: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  approved: ['suspended', 'superseded'],
  rejected: [],
  suspended: [],
  superseded: [],
}

export async function createSubmission(submission: NewAppSubmission): Promise<AppSubmissionsTable> {
  return getDb()
    .insertInto('app_submissions')
    .values(submission)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findSubmissionById(id: string): Promise<AppSubmissionsTable | undefined> {
  return getDb()
    .selectFrom('app_submissions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function findSubmissionByVersionId(versionId: string): Promise<AppSubmissionsTable | undefined> {
  return getDb()
    .selectFrom('app_submissions')
    .selectAll()
    .where('version_id', '=', versionId)
    .executeTakeFirst()
}

export async function findSubmissionsByAppId(appId: string): Promise<AppSubmissionsTable[]> {
  return getDb()
    .selectFrom('app_submissions')
    .selectAll()
    .where('app_id', '=', appId)
    .orderBy('submitted_at', 'desc')
    .execute()
}

export async function listSubmissions(filters?: {
  app_id?: string
  status?: string[]
  limit?: number
  offset?: number
}): Promise<{ submissions: AppSubmissionsTable[]; total: number }> {
  let query = getDb().selectFrom('app_submissions').selectAll()
  let countQuery = getDb().selectFrom('app_submissions').select(sql<number>`count(*)::int`.as('count'))

  if (filters?.app_id) {
    query = query.where('app_id', '=', filters.app_id)
    countQuery = countQuery.where('app_id', '=', filters.app_id)
  }
  if (filters?.status && filters.status.length > 0) {
    query = query.where('status', 'in', filters.status)
    countQuery = countQuery.where('status', 'in', filters.status)
  }

  query = query.orderBy('submitted_at', 'desc')
  if (filters?.limit) query = query.limit(filters.limit)
  if (filters?.offset) query = query.offset(filters.offset)

  const [submissions, countResult] = await Promise.all([
    query.execute(),
    countQuery.executeTakeFirstOrThrow(),
  ])

  return { submissions, total: (countResult as any).count }
}

export async function transitionStatus(
  id: string,
  newStatus: string
): Promise<AppSubmissionsTable> {
  const submission = await findSubmissionById(id)
  if (!submission) throw new Error(`Submission ${id} not found`)

  const allowed = VALID_TRANSITIONS[submission.status]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${submission.status} → ${newStatus}`)
  }

  const updates: Partial<AppSubmissionsTable> = { status: newStatus } as any

  if (newStatus === 'pending_checks') {
    (updates as any).checks_started_at = new Date()
  } else if (newStatus === 'pending_review') {
    (updates as any).checks_completed_at = new Date()
  } else if (newStatus === 'approved' || newStatus === 'rejected') {
    (updates as any).review_completed_at = new Date()
  }

  return getDb()
    .updateTable('app_submissions')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateSubmission(
  id: string,
  updates: Partial<Pick<AppSubmissionsTable, 'risk_level' | 'diff_result' | 'is_update' | 'prior_approved_version_id'>>
): Promise<AppSubmissionsTable> {
  return getDb()
    .updateTable('app_submissions')
    .set(updates as any)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function hasActiveReview(appId: string): Promise<boolean> {
  const result = await getDb()
    .selectFrom('app_submissions')
    .select(sql<number>`1`.as('exists'))
    .where('app_id', '=', appId)
    .where('status', 'in', ['pending_checks', 'pending_review'])
    .executeTakeFirst()
  return !!result
}
