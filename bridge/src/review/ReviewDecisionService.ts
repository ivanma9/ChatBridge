import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'
import * as findingRepo from '../db/repositories/findingRepository.js'
import * as appRepo from '../db/repositories/appRepository.js'
import * as registryRepo from '../db/repositories/registryRepository.js'
import { getDb } from '../db/connection.js'

export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError' }
}
export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError' }
}

export interface DecideInput {
  submission_id: string
  decision: 'approved' | 'rejected'
  rationale: string
  findings_considered: string[]
  reviewer_id: string
}

export interface DecideResult {
  submission_id: string
  status: string
  registry_entry_created: boolean
  registry_entry_updated: boolean
  prior_version_superseded: boolean
}

export async function decide(input: DecideInput): Promise<DecideResult> {
  const { submission_id, decision, rationale, findings_considered, reviewer_id } = input

  if (!rationale || rationale.trim() === '') {
    throw new ValidationError('Rationale is required')
  }

  const submission = await submissionRepo.findSubmissionById(submission_id)
  if (!submission) throw new NotFoundError('Submission not found')
  if (submission.status !== 'pending_review') {
    throw new ValidationError('Submission must be in pending_review status to decide')
  }

  // Record the decision
  await findingRepo.createDecision({
    submission_id,
    decision,
    rationale,
    reviewer_id,
    findings_considered,
  })

  let registryEntryCreated = false
  let registryEntryUpdated = false
  let priorVersionSuperseded = false

  if (decision === 'rejected') {
    // Transition to rejected (terminal)
    await submissionRepo.transitionStatus(submission_id, 'rejected')
  } else if (decision === 'approved') {
    // Transition to approved
    await submissionRepo.transitionStatus(submission_id, 'approved')

    // Get version and app for registry entry
    const version = await appRepo.findVersionById(submission.version_id)
    const app = await appRepo.findAppById(submission.app_id)
    if (!version || !app) throw new NotFoundError('Version or app not found')

    const manifest = version.manifest as ChatBridgeAppManifest
    try {
      const entryOrigin = new URL(manifest.entryUrl).origin
      if (entryOrigin !== manifest.origin) {
        throw new ValidationError('Approved app versions must declare an origin that exactly matches the entryUrl origin')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError('Approved app versions must provide a valid entryUrl and origin')
    }

    // Check if prior approved version exists (for supersede)
    if (submission.is_update && submission.prior_approved_version_id) {
      // Find the prior version's submission and mark it superseded
      const priorSubmission = await submissionRepo.findSubmissionByVersionId(submission.prior_approved_version_id)
      if (priorSubmission && priorSubmission.status === 'approved') {
        await submissionRepo.transitionStatus(priorSubmission.id, 'superseded')
        priorVersionSuperseded = true
      }
    }

    // Check if registry entry already exists for this app
    const existingEntry = await registryRepo.findRegistryEntry(submission.app_id)
    registryEntryUpdated = !!existingEntry
    registryEntryCreated = !existingEntry

    // Upsert registry entry
    await registryRepo.upsertRegistryEntry({
      app_id: submission.app_id,
      version_id: submission.version_id,
      display_name: manifest.name,
      display_description: manifest.description || null,
      display_category: app.category || null,
      tool_schemas: JSON.stringify(manifest.tools),
      entry_url: manifest.entryUrl,
      allowed_origin: manifest.origin,
    })
  }

  return {
    submission_id,
    status: decision,
    registry_entry_created: registryEntryCreated,
    registry_entry_updated: registryEntryUpdated,
    prior_version_superseded: priorVersionSuperseded,
  }
}

export async function suspend(versionId: string, rationale: string, reviewerId: string): Promise<{
  version_id: string
  status: string
  registry_entry_removed: boolean
}> {
  if (!rationale || rationale.trim() === '') {
    throw new ValidationError('Rationale is required for suspension')
  }

  // Find the submission for this version
  const submission = await submissionRepo.findSubmissionByVersionId(versionId)
  if (!submission) throw new NotFoundError('No submission found for this version')
  if (submission.status !== 'approved') {
    throw new ValidationError('Only approved versions can be suspended')
  }

  // Transition to suspended (terminal)
  await submissionRepo.transitionStatus(submission.id, 'suspended')

  // Remove from registry
  const removed = await registryRepo.deleteRegistryEntry(submission.app_id)

  return {
    version_id: versionId,
    status: 'suspended',
    registry_entry_removed: removed,
  }
}
