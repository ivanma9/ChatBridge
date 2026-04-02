import { Router } from 'express'
import {
  decide,
  suspend,
  NotFoundError,
  ValidationError,
} from '../review/ReviewDecisionService.js'
import * as findingRepo from '../db/repositories/findingRepository.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'

export const decisionRouter = Router()

// POST /api/admin/submissions/:id/decide
decisionRouter.post('/submissions/:id/decide', async (req, res) => {
  try {
    const { decision, rationale, findings_considered } = req.body

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'decision must be "approved" or "rejected"' })
      return
    }

    const result = await decide({
      submission_id: req.params.id,
      decision,
      rationale: rationale || '',
      findings_considered: findings_considered || [],
      reviewer_id: 'reviewer', // V1: single reviewer role
    })

    res.json(result)
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[decisions] Decide error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admin/submissions/:id/findings — Add manual finding
decisionRouter.post('/submissions/:id/findings', async (req, res) => {
  try {
    const submission = await submissionRepo.findSubmissionById(req.params.id)
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' })
      return
    }
    if (submission.status !== 'pending_review') {
      res.status(400).json({ error: 'Can only add findings to submissions in pending_review status' })
      return
    }

    const { finding_type, severity, title, description, affected_path } = req.body
    if (!finding_type || !severity || !title || !description) {
      res.status(400).json({ error: 'finding_type, severity, title, and description are required' })
      return
    }

    const finding = await findingRepo.createFinding({
      submission_id: req.params.id,
      source: 'manual',
      check_name: 'manual_review',
      finding_type,
      severity,
      title,
      description,
      change_context: null,
      affected_path: affected_path || null,
      created_by: 'reviewer', // V1: single reviewer role
    })

    res.status(201).json({ finding_id: finding.id, ...finding })
  } catch (err) {
    console.error('[decisions] Add finding error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admin/versions/:id/suspend
decisionRouter.post('/versions/:id/suspend', async (req, res) => {
  try {
    const { rationale } = req.body
    const result = await suspend(
      req.params.id,
      rationale || '',
      'reviewer', // V1: single reviewer role
    )
    res.json(result)
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[decisions] Suspend error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
