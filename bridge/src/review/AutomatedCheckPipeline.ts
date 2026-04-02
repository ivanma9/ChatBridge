import type { ChatBridgeAppManifest, ReviewRiskLevel, DiffResult } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './checks/ManifestSchemaCheck.js'
import { runManifestSchemaCheck } from './checks/ManifestSchemaCheck.js'
import { runPermissionPolicyCheck } from './checks/PermissionPolicyCheck.js'
import { runOriginAllowlistCheck } from './checks/OriginAllowlistCheck.js'
import { runContentPolicyCheck } from './checks/ContentPolicyCheck.js'
import { runScopeExpansionCheck } from './checks/ScopeExpansionCheck.js'
import { assessRiskFromFindings, combineRiskLevels } from './RiskAssessor.js'
import * as findingRepo from '../db/repositories/findingRepository.js'
import * as submissionRepo from '../db/repositories/submissionRepository.js'

type CheckFn = (manifest: ChatBridgeAppManifest) => Promise<CheckFinding[]>

const BASE_CHECKS: CheckFn[] = [
  runManifestSchemaCheck,
  runPermissionPolicyCheck,
  runOriginAllowlistCheck,
  runContentPolicyCheck,
]

export interface PipelineResult {
  findings: CheckFinding[]
  riskLevel: ReviewRiskLevel
  success: boolean
  error?: string
}

export async function runAutomatedChecks(
  submissionId: string,
  manifest: ChatBridgeAppManifest,
  priorManifest?: ChatBridgeAppManifest,
  diffResult?: DiffResult | null
): Promise<PipelineResult> {
  const allFindings: CheckFinding[] = []

  try {
    // Run base checks
    for (const check of BASE_CHECKS) {
      const findings = await check(manifest)
      allFindings.push(...findings)
    }

    // Run scope expansion check for updates
    if (priorManifest) {
      const expansionFindings = await runScopeExpansionCheck(manifest, priorManifest)
      allFindings.push(...expansionFindings)
    }

    // Store findings in DB
    if (allFindings.length > 0) {
      await findingRepo.createFindings(
        allFindings.map((f) => ({
          submission_id: submissionId,
          ...f,
        }))
      )
    }

    // Assess risk from findings
    const severities = allFindings.map((f) => f.severity)
    let riskLevel = assessRiskFromFindings(severities)

    // Combine with diff-derived risk if available
    if (diffResult) {
      riskLevel = combineRiskLevels(riskLevel, diffResult.overall_risk_level)
    }

    // Update submission risk level
    await submissionRepo.updateSubmission(submissionId, { risk_level: riskLevel })

    return { findings: allFindings, riskLevel, success: true }
  } catch (error) {
    return {
      findings: allFindings,
      riskLevel: 'low',
      success: false,
      error: (error as Error).message,
    }
  }
}
