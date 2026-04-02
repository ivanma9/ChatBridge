import type { ReviewRiskLevel, FindingSeverity } from '../../../../packages/app-sdk/src/contracts.js'

const SEVERITY_ORDER: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export function assessRiskFromFindings(severities: string[]): ReviewRiskLevel {
  const maxSeverity = severities.reduce((max, s) => {
    return (SEVERITY_ORDER[s] ?? 0) > (SEVERITY_ORDER[max] ?? 0) ? s : max
  }, 'info')

  switch (maxSeverity) {
    case 'critical': return 'critical'
    case 'high': return 'high'
    case 'medium': return 'medium'
    default: return 'low'
  }
}

export function combineRiskLevels(a: ReviewRiskLevel, b: ReviewRiskLevel): ReviewRiskLevel {
  const order: ReviewRiskLevel[] = ['low', 'medium', 'high', 'critical']
  const aIdx = order.indexOf(a)
  const bIdx = order.indexOf(b)
  return order[Math.max(aIdx, bIdx)]
}
