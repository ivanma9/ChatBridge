import { getDb } from '../connection.js'
import type { ReviewFindingsTable, ReviewDecisionsTable } from '../connection.js'

export type NewFinding = Omit<ReviewFindingsTable, 'id' | 'created_at'>
export type NewDecision = Omit<ReviewDecisionsTable, 'id' | 'decided_at'>

export async function createFinding(finding: NewFinding): Promise<ReviewFindingsTable> {
  return getDb()
    .insertInto('review_findings')
    .values(finding)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function createFindings(findings: NewFinding[]): Promise<ReviewFindingsTable[]> {
  if (findings.length === 0) return []
  return getDb()
    .insertInto('review_findings')
    .values(findings)
    .returningAll()
    .execute()
}

export async function findFindingsBySubmissionId(submissionId: string): Promise<ReviewFindingsTable[]> {
  return getDb()
    .selectFrom('review_findings')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .orderBy('created_at', 'asc')
    .execute()
}

export async function findFindingById(id: string): Promise<ReviewFindingsTable | undefined> {
  return getDb()
    .selectFrom('review_findings')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function createDecision(decision: NewDecision): Promise<ReviewDecisionsTable> {
  return getDb()
    .insertInto('review_decisions')
    .values(decision)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findDecisionBySubmissionId(submissionId: string): Promise<ReviewDecisionsTable | undefined> {
  return getDb()
    .selectFrom('review_decisions')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .executeTakeFirst()
}
