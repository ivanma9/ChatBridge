import { Router } from 'express'
import {
  createSubmission,
  initiateReview,
  retryChecks,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../review/SubmissionService.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'
import * as appRepo from '../db/repositories/appRepository.js'
import * as findingRepo from '../db/repositories/findingRepository.js'

export const submissionRouter = Router()

// POST /api/admin/submissions — Create new submission
submissionRouter.post('/', async (req, res) => {
  try {
    const { manifest, metadata } = req.body
    if (!manifest) {
      res.status(400).json({ error: 'manifest is required' })
      return
    }

    const result = await createSubmission({
      manifest,
      metadata,
      submitted_by: 'reviewer', // V1: single reviewer role
    })

    res.status(201).json(result)
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[submissions] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admin/submissions/:id/initiate-review
submissionRouter.post('/:id/initiate-review', async (req, res) => {
  try {
    const result = await initiateReview(req.params.id)
    res.json({ submission_id: req.params.id, ...result })
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[submissions] Initiate review error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admin/submissions/:id/retry-checks
submissionRouter.post('/:id/retry-checks', async (req, res) => {
  try {
    const result = await retryChecks(req.params.id)
    res.json({ submission_id: req.params.id, ...result })
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[submissions] Retry checks error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/admin/submissions/:id — Get full submission details
submissionRouter.get('/:id', async (req, res) => {
  try {
    const submission = await submissionRepo.findSubmissionById(req.params.id)
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' })
      return
    }

    const app = await appRepo.findAppById(submission.app_id)
    const version = await appRepo.findVersionById(submission.version_id)
    const findings = await findingRepo.findFindingsBySubmissionId(submission.id)
    const decision = await findingRepo.findDecisionBySubmissionId(submission.id)

    let priorApprovedVersion = undefined
    if (submission.prior_approved_version_id) {
      priorApprovedVersion = await appRepo.findVersionById(submission.prior_approved_version_id)
    }

    res.json({
      submission: {
        id: submission.id,
        version_id: submission.version_id,
        app_id: submission.app_id,
        status: submission.status,
        risk_level: submission.risk_level,
        is_update: submission.is_update,
        submitted_at: submission.submitted_at,
        submitted_by: submission.submitted_by,
      },
      app: app ? {
        id: app.id,
        external_id: app.external_id,
        display_name: app.display_name,
        vendor_name: app.vendor_name,
      } : null,
      version: version ? {
        id: version.id,
        version_identifier: version.version_identifier,
        manifest: version.manifest,
      } : null,
      prior_approved_version: priorApprovedVersion ? {
        id: priorApprovedVersion.id,
        version_identifier: priorApprovedVersion.version_identifier,
        manifest: priorApprovedVersion.manifest,
      } : undefined,
      diff: submission.diff_result || undefined,
      findings,
      decision: decision || undefined,
    })
  } catch (err) {
    console.error('[submissions] Get detail error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/admin/submissions — List with filtering
submissionRouter.get('/', async (req, res) => {
  try {
    const { app_id, status, limit, offset } = req.query
    const statusFilter = typeof status === 'string' ? status.split(',') : undefined

    const result = await submissionRepo.listSubmissions({
      app_id: app_id as string | undefined,
      status: statusFilter,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    })

    res.json({ submissions: result.submissions, total: result.total })
  } catch (err) {
    console.error('[submissions] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
