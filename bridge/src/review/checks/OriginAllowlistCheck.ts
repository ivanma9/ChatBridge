import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './ManifestSchemaCheck.js'

const SAFE_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.chatbridge\.dev$/,
  /^https:\/\/[a-z0-9-]+\.chatbridge\.io$/,
]

export async function runOriginAllowlistCheck(manifest: ChatBridgeAppManifest): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = []
  const check_name = 'origin_allowlist'
  const base = { source: 'automated' as const, check_name, finding_type: 'security' as const, change_context: null, created_by: 'system' as const }

  const origin = manifest.origin
  if (typeof origin !== 'string' || origin.trim() === '') return findings

  const isSafe = SAFE_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))

  if (!isSafe) {
    findings.push({
      ...base,
      severity: 'high',
      title: `Unknown origin: ${origin}`,
      description: `The origin "${origin}" is not on the known-safe allowlist. External origins require manual verification to ensure they do not serve unsafe content.`,
      affected_path: 'origin',
    })
  }

  // Check entryUrl matches origin
  if (manifest.entryUrl && typeof manifest.entryUrl === 'string') {
    try {
      const entryOrigin = new URL(manifest.entryUrl).origin
      if (entryOrigin !== origin) {
        findings.push({
          ...base,
          severity: 'critical',
          title: 'entryUrl origin mismatch',
          description: `The entryUrl origin "${entryOrigin}" does not match the declared origin "${origin}". This may indicate a cross-origin embedding risk.`,
          affected_path: 'entryUrl',
        })
      }
    } catch {
      // URL validation is handled by ManifestSchemaCheck
    }
  }

  return findings
}
