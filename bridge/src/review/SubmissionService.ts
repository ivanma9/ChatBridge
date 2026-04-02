import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import * as appRepo from '../db/repositories/appRepository.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'
import { runAutomatedChecks } from './AutomatedCheckPipeline.js'
import { generateDiff } from './DiffGenerator.js'

export interface CreateSubmissionInput {
  manifest: ChatBridgeAppManifest
  metadata?: {
    vendor_name?: string
    category?: string
    notes?: string
  }
  submitted_by: string
}

export interface CreateSubmissionResult {
  submission_id: string
  app_id: string
  version_id: string
  status: string
  is_update: boolean
  prior_approved_version_id: string | null
}

export async function createSubmission(input: CreateSubmissionInput): Promise<CreateSubmissionResult> {
  const { manifest, metadata, submitted_by } = input

  // Check if app already exists
  let app = await appRepo.findAppByExternalId(manifest.id)
  let isUpdate = false
  let priorApprovedVersionId: string | null = null

  if (app) {
    // Check for active review
    const hasActive = await submissionRepo.hasActiveReview(app.id)
    if (hasActive) {
      throw new ConflictError('An active review already exists for this app')
    }

    // Check for prior approved version
    const priorVersion = await appRepo.findLatestApprovedVersion(app.id)
    if (priorVersion) {
      isUpdate = true
      priorApprovedVersionId = priorVersion.id
    }

    // Update app metadata if provided
  } else {
    // Create new app
    app = await appRepo.createApp({
      external_id: manifest.id,
      display_name: metadata?.vendor_name ? manifest.name : manifest.name,
      vendor_name: metadata?.vendor_name || 'Unknown',
      category: metadata?.category || null,
    })
  }

  // Create version
  const version = await appRepo.createAppVersion({
    app_id: app.id,
    version_identifier: manifest.version,
    manifest: manifest as unknown,
    manifest_hash: appRepo.hashManifest(manifest),
    created_by: submitted_by,
  })

  // Generate diff if this is an update
  let diffResult = null
  if (isUpdate && priorApprovedVersionId) {
    const priorVersion = await appRepo.findVersionById(priorApprovedVersionId)
    if (priorVersion) {
      diffResult = generateDiff(
        priorApprovedVersionId,
        version.id,
        priorVersion.manifest as ChatBridgeAppManifest,
        manifest
      )
    }
  }

  // Create submission
  const submission = await submissionRepo.createSubmission({
    version_id: version.id,
    app_id: app.id,
    status: 'draft',
    risk_level: null,
    is_update: isUpdate,
    prior_approved_version_id: priorApprovedVersionId,
    diff_result: diffResult as unknown,
    submitted_by,
  })

  return {
    submission_id: submission.id,
    app_id: app.id,
    version_id: version.id,
    status: submission.status,
    is_update: isUpdate,
    prior_approved_version_id: priorApprovedVersionId,
  }
}

export async function initiateReview(submissionId: string): Promise<{ status: string; message: string }> {
  const submission = await submissionRepo.findSubmissionById(submissionId)
  if (!submission) throw new NotFoundError('Submission not found')
  if (submission.status !== 'draft') {
    throw new ValidationError('Submission must be in draft status to initiate review')
  }

  // Get the version manifest
  const version = await appRepo.findVersionById(submission.version_id)
  if (!version) throw new NotFoundError('Version not found')

  const manifest = version.manifest as ChatBridgeAppManifest

  // Get prior manifest if this is an update
  let priorManifest: ChatBridgeAppManifest | undefined
  if (submission.prior_approved_version_id) {
    const priorVersion = await appRepo.findVersionById(submission.prior_approved_version_id)
    if (priorVersion) priorManifest = priorVersion.manifest as ChatBridgeAppManifest
  }

  // Transition to pending_checks
  await submissionRepo.transitionStatus(submissionId, 'pending_checks')

  // Run automated checks (with prior manifest and diff for updates)
  const diffResult = submission.diff_result as import('../../../../packages/app-sdk/src/contracts.js').DiffResult | null
  const result = await runAutomatedChecks(submissionId, manifest, priorManifest, diffResult)

  if (!result.success) {
    // Stay in pending_checks — reviewer can retry
    return { status: 'pending_checks', message: `Automated checks failed: ${result.error}. Use retry-checks to try again.` }
  }

  // Transition to pending_review
  await submissionRepo.transitionStatus(submissionId, 'pending_review')

  return { status: 'pending_review', message: 'Automated checks complete. Ready for manual review.' }
}

export async function retryChecks(submissionId: string): Promise<{ status: string; message: string }> {
  const submission = await submissionRepo.findSubmissionById(submissionId)
  if (!submission) throw new NotFoundError('Submission not found')
  if (submission.status !== 'pending_checks') {
    throw new ValidationError('Submission must be in pending_checks status to retry')
  }

  const version = await appRepo.findVersionById(submission.version_id)
  if (!version) throw new NotFoundError('Version not found')

  const manifest = version.manifest as ChatBridgeAppManifest
  const result = await runAutomatedChecks(submissionId, manifest)

  if (!result.success) {
    return { status: 'pending_checks', message: `Checks failed again: ${result.error}` }
  }

  await submissionRepo.transitionStatus(submissionId, 'pending_review')
  return { status: 'pending_review', message: 'Automated checks complete on retry. Ready for manual review.' }
}

// Error classes
export class ConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'ConflictError' }
}
export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError' }
}
export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError' }
}
