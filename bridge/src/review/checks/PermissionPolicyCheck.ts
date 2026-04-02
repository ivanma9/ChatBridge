import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './ManifestSchemaCheck.js'

const DANGEROUS_PERMISSIONS = ['camera', 'microphone', 'geolocation', 'contacts', 'storage_write', 'notifications_push']
const K12_RESTRICTED_PERMISSIONS = ['social_media', 'advertising', 'analytics_third_party', 'purchase', 'external_links_unrestricted']

export async function runPermissionPolicyCheck(manifest: ChatBridgeAppManifest): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = []
  const check_name = 'permission_policy'
  const base = { source: 'automated' as const, check_name, finding_type: 'safety' as const, change_context: null, created_by: 'system' as const }

  if (!Array.isArray(manifest.permissions)) return findings

  for (const perm of manifest.permissions) {
    if (DANGEROUS_PERMISSIONS.includes(perm)) {
      findings.push({
        ...base,
        severity: 'high',
        title: `Dangerous permission requested: ${perm}`,
        description: `The permission "${perm}" grants access to sensitive device capabilities and requires explicit justification for K-12 use.`,
        affected_path: `permissions.${perm}`,
      })
    }
    if (K12_RESTRICTED_PERMISSIONS.includes(perm)) {
      findings.push({
        ...base,
        severity: 'critical',
        title: `K-12 restricted permission: ${perm}`,
        description: `The permission "${perm}" is restricted in K-12 environments due to safety and compliance concerns (COPPA/FERPA).`,
        affected_path: `permissions.${perm}`,
      })
    }
  }

  return findings
}
