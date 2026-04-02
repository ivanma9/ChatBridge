import { Router } from 'express'
import * as appRepo from '../db/repositories/appRepository.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'
import * as findingRepo from '../db/repositories/findingRepository.js'

export const historyRouter = Router()

// GET /api/admin/apps/:id/history — Full version review history
historyRouter.get('/:id/history', async (req, res) => {
  try {
    const app = await appRepo.findAppById(req.params.id)
    if (!app) {
      res.status(404).json({ error: 'App not found' })
      return
    }

    const versions = await appRepo.findVersionsByAppId(app.id)

    const history = await Promise.all(
      versions.map(async (version) => {
        const submission = await submissionRepo.findSubmissionByVersionId(version.id)
        const findings = submission
          ? await findingRepo.findFindingsBySubmissionId(submission.id)
          : []
        const decision = submission
          ? await findingRepo.findDecisionBySubmissionId(submission.id)
          : undefined

        return {
          version: {
            id: version.id,
            version_identifier: version.version_identifier,
            manifest: version.manifest,
            created_at: version.created_at,
          },
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                risk_level: submission.risk_level,
                is_update: submission.is_update,
                submitted_at: submission.submitted_at,
              }
            : null,
          findings,
          decision: decision || undefined,
        }
      })
    )

    res.json({ app, versions: history })
  } catch (err) {
    console.error('[history] Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
