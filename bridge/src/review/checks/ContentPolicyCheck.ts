import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './ManifestSchemaCheck.js'

const PROHIBITED_TERMS = [
  'gambling', 'casino', 'betting', 'alcohol', 'tobacco',
  'vape', 'vaping', 'dating', 'adult', 'nsfw',
  'weapon', 'firearms', 'cryptocurrency', 'crypto trading',
]

const SUSPICIOUS_PATTERNS = [
  /track(ing|er)/i,
  /advertis(e|ing|ement)/i,
  /data\s*collect(ion|ing)/i,
  /third[- ]party\s*analytic/i,
]

export async function runContentPolicyCheck(manifest: ChatBridgeAppManifest): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = []
  const check_name = 'content_policy'
  const base = { source: 'automated' as const, check_name, finding_type: 'policy' as const, change_context: null, created_by: 'system' as const }

  const textToScan = `${manifest.name} ${manifest.description}`.toLowerCase()

  for (const term of PROHIBITED_TERMS) {
    if (textToScan.includes(term)) {
      findings.push({
        ...base,
        severity: 'critical',
        title: `Prohibited content: "${term}"`,
        description: `The app name or description contains "${term}", which is not appropriate for K-12 educational environments.`,
        affected_path: 'description',
      })
    }
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(textToScan)) {
      findings.push({
        ...base,
        severity: 'medium',
        title: `Suspicious content pattern detected`,
        description: `The app metadata matches the pattern "${pattern.source}", which may indicate data collection or advertising behavior that requires review.`,
        affected_path: 'description',
      })
    }
  }

  return findings
}
