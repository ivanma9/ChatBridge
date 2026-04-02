import { describe, it, expect } from 'vitest'
import { generateDiff } from '../../src/review/DiffGenerator'
import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts'

const BASE_MANIFEST: ChatBridgeAppManifest = {
  id: 'test-app',
  version: '1.0.0',
  name: 'Test App',
  description: 'A test app',
  entryUrl: 'http://localhost:5173',
  origin: 'http://localhost:5173',
  permissions: [],
  scopes: [],
  tools: [{ name: 'tool1', description: 'Tool 1', inputSchema: {} }],
}

describe('DiffGenerator', () => {
  it('should return no changes for identical manifests', () => {
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, { ...BASE_MANIFEST })
    expect(diff.summary.total_changes).toBe(0)
    expect(diff.overall_risk_level).toBe('low')
  })

  it('should detect added permissions as critical', () => {
    const updated = { ...BASE_MANIFEST, permissions: ['camera'] }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.changes.some(c => c.path.includes('permissions') && c.kind === 'added')).toBe(true)
    expect(diff.changes.some(c => c.risk_category === 'critical')).toBe(true)
    expect(['high', 'critical']).toContain(diff.overall_risk_level)
  })

  it('should detect added scopes as critical', () => {
    const updated = { ...BASE_MANIFEST, scopes: ['student_name'] }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.changes.some(c => c.path.includes('scopes') && c.kind === 'added')).toBe(true)
  })

  it('should detect name change as standard', () => {
    const updated = { ...BASE_MANIFEST, name: 'New Name' }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.changes.length).toBeGreaterThan(0)
    expect(diff.changes.some(c => c.path.includes('name') && c.risk_category === 'standard')).toBe(true)
    expect(diff.overall_risk_level).toBe('low')
  })

  it('should detect origin change as critical', () => {
    const updated = { ...BASE_MANIFEST, origin: 'https://new-origin.com' }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.changes.some(c => c.path.includes('origin') && c.risk_category === 'critical')).toBe(true)
  })

  it('should detect added tools as elevated', () => {
    const updated = { ...BASE_MANIFEST, tools: [...BASE_MANIFEST.tools, { name: 'tool2', description: 'Tool 2', inputSchema: {} }] }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.summary.additions).toBeGreaterThan(0)
  })

  it('should aggregate to critical when 3+ critical changes', () => {
    const updated = {
      ...BASE_MANIFEST,
      permissions: ['camera', 'microphone', 'geolocation'],
      origin: 'https://new-origin.com',
    }
    const diff = generateDiff('v1', 'v2', BASE_MANIFEST, updated)
    expect(diff.overall_risk_level).toBe('critical')
  })
})
