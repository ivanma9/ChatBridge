import { describe, it, expect } from 'vitest'
import { runManifestSchemaCheck } from '../../src/review/checks/ManifestSchemaCheck'
import { runPermissionPolicyCheck } from '../../src/review/checks/PermissionPolicyCheck'
import { runOriginAllowlistCheck } from '../../src/review/checks/OriginAllowlistCheck'
import { runContentPolicyCheck } from '../../src/review/checks/ContentPolicyCheck'
import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts'

const VALID_MANIFEST: ChatBridgeAppManifest = {
  id: 'test-app',
  version: '1.0.0',
  name: 'Test App',
  description: 'A safe educational test app',
  entryUrl: 'http://localhost:5173',
  origin: 'http://localhost:5173',
  permissions: [],
  scopes: [],
  tools: [{ name: 'test_tool', description: 'A test tool', inputSchema: {} }],
}

describe('ManifestSchemaCheck', () => {
  it('should pass for a valid manifest', async () => {
    const findings = await runManifestSchemaCheck(VALID_MANIFEST)
    expect(findings.filter(f => f.severity === 'critical')).toHaveLength(0)
  })

  it('should flag missing required fields', async () => {
    const bad = { ...VALID_MANIFEST, id: '' }
    const findings = await runManifestSchemaCheck(bad)
    expect(findings.some(f => f.affected_path === 'id')).toBe(true)
  })

  it('should flag invalid URLs', async () => {
    const bad = { ...VALID_MANIFEST, entryUrl: 'not-a-url' }
    const findings = await runManifestSchemaCheck(bad)
    expect(findings.some(f => f.affected_path === 'entryUrl')).toBe(true)
  })
})

describe('PermissionPolicyCheck', () => {
  it('should pass for no permissions', async () => {
    const findings = await runPermissionPolicyCheck(VALID_MANIFEST)
    expect(findings).toHaveLength(0)
  })

  it('should flag dangerous permissions', async () => {
    const manifest = { ...VALID_MANIFEST, permissions: ['camera', 'microphone'] }
    const findings = await runPermissionPolicyCheck(manifest)
    expect(findings.length).toBeGreaterThanOrEqual(2)
    expect(findings.every(f => f.severity === 'high')).toBe(true)
  })

  it('should flag K-12 restricted permissions', async () => {
    const manifest = { ...VALID_MANIFEST, permissions: ['advertising'] }
    const findings = await runPermissionPolicyCheck(manifest)
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })
})

describe('OriginAllowlistCheck', () => {
  it('should pass for localhost', async () => {
    const findings = await runOriginAllowlistCheck(VALID_MANIFEST)
    expect(findings).toHaveLength(0)
  })

  it('should flag unknown external origins', async () => {
    const manifest = { ...VALID_MANIFEST, origin: 'https://unknown-site.com' }
    const findings = await runOriginAllowlistCheck(manifest)
    expect(findings.some(f => f.title.includes('Unknown origin'))).toBe(true)
  })

  it('should flag origin/entryUrl mismatch', async () => {
    const manifest = { ...VALID_MANIFEST, entryUrl: 'http://different-origin:3000/app', origin: 'http://localhost:5173' }
    const findings = await runOriginAllowlistCheck(manifest)
    expect(findings.some(f => f.title.includes('mismatch'))).toBe(true)
  })
})

describe('ContentPolicyCheck', () => {
  it('should pass for safe content', async () => {
    const findings = await runContentPolicyCheck(VALID_MANIFEST)
    expect(findings).toHaveLength(0)
  })

  it('should flag prohibited content terms', async () => {
    const manifest = { ...VALID_MANIFEST, description: 'A gambling casino app' }
    const findings = await runContentPolicyCheck(manifest)
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })
})
