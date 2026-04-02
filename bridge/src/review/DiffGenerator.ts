import type {
  ChatBridgeAppManifest,
  DiffResult,
  DiffChange,
  ReviewRiskLevel,
} from '../../../../packages/app-sdk/src/contracts.js'

type RiskCategory = 'critical' | 'elevated' | 'standard'

interface RiskRule {
  pattern: RegExp
  kind: 'added' | 'removed' | 'modified' | '*'
  category: RiskCategory
  reason: string
}

const RISK_RULES: RiskRule[] = [
  { pattern: /^permissions\b/, kind: 'added', category: 'critical', reason: 'New permission added — trust-boundary expansion' },
  { pattern: /^permissions\b/, kind: 'removed', category: 'standard', reason: 'Permission removed — reduced access' },
  { pattern: /^scopes\b/, kind: 'added', category: 'critical', reason: 'New scope added — trust-boundary expansion' },
  { pattern: /^scopes\b/, kind: 'removed', category: 'standard', reason: 'Scope removed — reduced access' },
  { pattern: /^origin$/, kind: '*', category: 'critical', reason: 'Origin changed — potential cross-origin risk' },
  { pattern: /^tools\b/, kind: 'added', category: 'elevated', reason: 'New tool registered' },
  { pattern: /^tools\b/, kind: 'removed', category: 'elevated', reason: 'Tool removed' },
  { pattern: /^tools\b.*inputSchema/, kind: 'modified', category: 'elevated', reason: 'Tool input schema modified' },
  { pattern: /^entryUrl$/, kind: '*', category: 'elevated', reason: 'Entry URL changed — may point to different content' },
  { pattern: /^name$/, kind: '*', category: 'standard', reason: 'Display name changed' },
  { pattern: /^description$/, kind: '*', category: 'standard', reason: 'Description changed' },
  { pattern: /^version$/, kind: '*', category: 'standard', reason: 'Version identifier changed' },
]

function classifyChange(path: string, kind: DiffChange['kind']): { category: RiskCategory; reason: string } {
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(path) && (rule.kind === '*' || rule.kind === kind)) {
      return { risk_category: rule.category, risk_reason: rule.reason }
    }
  }
  return { risk_category: 'standard' as const, risk_reason: 'Field changed' }
}

function diffArrays(path: string, oldArr: unknown[], newArr: unknown[]): DiffChange[] {
  const changes: DiffChange[] = []
  const oldSet = new Set(oldArr.map((v) => JSON.stringify(v)))
  const newSet = new Set(newArr.map((v) => JSON.stringify(v)))

  for (const item of newArr) {
    const key = JSON.stringify(item)
    if (!oldSet.has(key)) {
      const itemPath = typeof item === 'string' ? `${path}.${item}` : path
      const cls = classifyChange(itemPath, 'added')
      changes.push({
        path: itemPath,
        kind: 'added',
        old_value: null,
        new_value: item,
        risk_category: cls.risk_category,
        risk_reason: cls.risk_reason,
      })
    }
  }

  for (const item of oldArr) {
    const key = JSON.stringify(item)
    if (!newSet.has(key)) {
      const itemPath = typeof item === 'string' ? `${path}.${item}` : path
      const cls = classifyChange(itemPath, 'removed')
      changes.push({
        path: itemPath,
        kind: 'removed',
        old_value: item,
        new_value: null,
        risk_category: cls.risk_category,
        risk_reason: cls.risk_reason,
      })
    }
  }

  return changes
}

function diffValues(path: string, oldVal: unknown, newVal: unknown): DiffChange[] {
  if (oldVal === newVal) return []
  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return []

  const changes: DiffChange[] = []

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return diffArrays(path, oldVal, newVal)
  }

  if (oldVal === undefined || oldVal === null) {
    const cls = classifyChange(path, 'added')
    changes.push({ path, kind: 'added', old_value: null, new_value: newVal, ...cls })
    return changes
  }

  if (newVal === undefined || newVal === null) {
    const cls = classifyChange(path, 'removed')
    changes.push({ path, kind: 'removed', old_value: oldVal, new_value: null, ...cls })
    return changes
  }

  if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
    const allKeys = new Set([...Object.keys(oldVal as object), ...Object.keys(newVal as object)])
    for (const key of allKeys) {
      changes.push(...diffValues(`${path}.${key}`, (oldVal as any)[key], (newVal as any)[key]))
    }
    return changes
  }

  const cls = classifyChange(path, 'modified')
  changes.push({ path, kind: 'modified', old_value: oldVal, new_value: newVal, ...cls })
  return changes
}

function aggregateRiskLevel(changes: DiffChange[]): ReviewRiskLevel {
  let criticalCount = 0
  let hasElevated = false

  for (const change of changes) {
    if (change.risk_category === 'critical') criticalCount++
    if (change.risk_category === 'elevated') hasElevated = true
  }

  if (criticalCount >= 3) return 'critical'
  if (criticalCount > 0) return 'high'
  if (hasElevated) return 'medium'
  return 'low'
}

export function generateDiff(
  priorVersionId: string,
  newVersionId: string,
  priorManifest: ChatBridgeAppManifest,
  newManifest: ChatBridgeAppManifest
): DiffResult {
  const fieldsToCompare: (keyof ChatBridgeAppManifest)[] = [
    'name', 'description', 'version', 'entryUrl', 'origin',
    'permissions', 'scopes', 'tools',
  ]

  const allChanges: DiffChange[] = []
  for (const field of fieldsToCompare) {
    allChanges.push(...diffValues(field, priorManifest[field], newManifest[field]))
  }

  const additions = allChanges.filter((c) => c.kind === 'added').length
  const removals = allChanges.filter((c) => c.kind === 'removed').length
  const modifications = allChanges.filter((c) => c.kind === 'modified').length
  const riskSensitive = allChanges.filter((c) => c.risk_category !== 'standard').length

  return {
    prior_version_id: priorVersionId,
    new_version_id: newVersionId,
    generated_at: new Date().toISOString(),
    overall_risk_level: aggregateRiskLevel(allChanges),
    summary: {
      total_changes: allChanges.length,
      additions,
      removals,
      modifications,
      risk_sensitive_changes: riskSensitive,
    },
    changes: allChanges,
  }
}
