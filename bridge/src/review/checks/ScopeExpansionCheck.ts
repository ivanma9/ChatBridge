import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './ManifestSchemaCheck.js'

export async function runScopeExpansionCheck(
  manifest: ChatBridgeAppManifest,
  priorManifest: ChatBridgeAppManifest
): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = []
  const check_name = 'scope_expansion'
  const base = {
    source: 'automated' as const,
    check_name,
    finding_type: 'safety' as const,
    created_by: 'system' as const,
  }

  // Check for new permissions
  const priorPerms = new Set(priorManifest.permissions || [])
  for (const perm of manifest.permissions || []) {
    if (!priorPerms.has(perm)) {
      findings.push({
        ...base,
        severity: 'high',
        title: `New permission: ${perm}`,
        description: `Permission "${perm}" was not present in the approved version ${priorManifest.version}. This is a trust-boundary expansion requiring elevated review.`,
        change_context: 'new_field',
        affected_path: `permissions.${perm}`,
      })
    }
  }

  // Check for new scopes
  const priorScopes = new Set(priorManifest.scopes || [])
  for (const scope of manifest.scopes || []) {
    if (!priorScopes.has(scope)) {
      findings.push({
        ...base,
        severity: 'high',
        title: `New scope: ${scope}`,
        description: `Scope "${scope}" was not present in the approved version ${priorManifest.version}. This is a trust-boundary expansion requiring elevated review.`,
        change_context: 'new_field',
        affected_path: `scopes.${scope}`,
      })
    }
  }

  // Check for origin change
  if (manifest.origin !== priorManifest.origin) {
    findings.push({
      ...base,
      finding_type: 'security',
      severity: 'high',
      title: 'Origin changed',
      description: `Origin changed from "${priorManifest.origin}" to "${manifest.origin}". This is a trust-boundary change requiring elevated review.`,
      change_context: 'changed_field',
      affected_path: 'origin',
    })
  }

  // Check for entryUrl change
  if (manifest.entryUrl !== priorManifest.entryUrl) {
    findings.push({
      ...base,
      finding_type: 'security',
      severity: 'medium',
      title: 'Entry URL changed',
      description: `Entry URL changed from "${priorManifest.entryUrl}" to "${manifest.entryUrl}".`,
      change_context: 'changed_field',
      affected_path: 'entryUrl',
    })
  }

  // Check for new tools
  const priorToolNames = new Set((priorManifest.tools || []).map((t) => t.name))
  for (const tool of manifest.tools || []) {
    if (!priorToolNames.has(tool.name)) {
      findings.push({
        ...base,
        finding_type: 'security',
        severity: 'medium',
        title: `New tool: ${tool.name}`,
        description: `Tool "${tool.name}" was not present in the approved version ${priorManifest.version}.`,
        change_context: 'new_field',
        affected_path: `tools.${tool.name}`,
      })
    }
  }

  return findings
}
