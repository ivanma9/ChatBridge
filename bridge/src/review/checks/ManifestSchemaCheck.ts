import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'

export interface CheckFinding {
  source: 'automated'
  check_name: string
  finding_type: 'safety' | 'security' | 'policy' | 'compliance'
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  change_context: string | null
  affected_path: string | null
  created_by: 'system'
}

export async function runManifestSchemaCheck(manifest: ChatBridgeAppManifest): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = []
  const check_name = 'manifest_schema'
  const base = { source: 'automated' as const, check_name, finding_type: 'security' as const, change_context: null, created_by: 'system' as const }

  // Required string fields
  const requiredStrings: (keyof ChatBridgeAppManifest)[] = ['id', 'version', 'name', 'description', 'entryUrl', 'origin']
  for (const field of requiredStrings) {
    const val = manifest[field]
    if (typeof val !== 'string' || val.trim() === '') {
      findings.push({
        ...base,
        severity: 'critical',
        title: `Missing or empty required field: ${field}`,
        description: `The manifest field "${field}" is required and must be a non-empty string.`,
        affected_path: field,
      })
    }
  }

  // URL validation
  for (const urlField of ['entryUrl', 'origin'] as const) {
    const val = manifest[urlField]
    if (typeof val === 'string' && val.trim() !== '') {
      try {
        new URL(val)
      } catch {
        findings.push({
          ...base,
          severity: 'high',
          title: `Invalid URL in ${urlField}`,
          description: `The value "${val}" is not a valid URL.`,
          affected_path: urlField,
        })
      }
    }
  }

  // Arrays must be arrays
  if (!Array.isArray(manifest.permissions)) {
    findings.push({ ...base, severity: 'critical', title: 'permissions must be an array', description: 'The permissions field must be an array of strings.', affected_path: 'permissions' })
  }
  if (!Array.isArray(manifest.scopes)) {
    findings.push({ ...base, severity: 'critical', title: 'scopes must be an array', description: 'The scopes field must be an array of strings.', affected_path: 'scopes' })
  }
  if (!Array.isArray(manifest.tools)) {
    findings.push({ ...base, severity: 'critical', title: 'tools must be an array', description: 'The tools field must be an array of tool manifests.', affected_path: 'tools' })
  }

  // Validate tools
  if (Array.isArray(manifest.tools)) {
    for (let i = 0; i < manifest.tools.length; i++) {
      const tool = manifest.tools[i]
      if (!tool.name || typeof tool.name !== 'string') {
        findings.push({ ...base, severity: 'high', title: `Tool at index ${i} missing name`, description: `Each tool must have a non-empty name string.`, affected_path: `tools[${i}].name` })
      }
      if (!tool.description || typeof tool.description !== 'string') {
        findings.push({ ...base, severity: 'medium', title: `Tool at index ${i} missing description`, description: `Each tool should have a description.`, affected_path: `tools[${i}].description` })
      }
    }
  }

  return findings
}
