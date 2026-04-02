import { describe, it, expect } from 'vitest'
import {
  TERMINAL_STATUSES,
  VALID_TRANSITIONS,
  type ApprovalStatus,
  type ReviewRiskLevel,
  type FindingType,
  type FindingSeverity,
  type FindingSource,
  type ChangeContext,
  type ActiveRegistryApp,
  type AppLaunchRequest,
  type AppLaunchResponse,
  type AppSessionStatus,
  type DiffResult,
  type DiffChange,
} from '../src/contracts'

describe('ApprovalStatus', () => {
  const ALL_STATUSES: ApprovalStatus[] = [
    'draft', 'pending_checks', 'pending_review',
    'approved', 'rejected', 'suspended', 'superseded',
  ]

  it('has exactly 7 valid statuses', () => {
    expect(ALL_STATUSES).toHaveLength(7)
  })

  it('terminal statuses are rejected, suspended, superseded', () => {
    expect(TERMINAL_STATUSES).toEqual(['rejected', 'suspended', 'superseded'])
  })

  it('terminal statuses have no valid transitions', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(VALID_TRANSITIONS[status]).toEqual([])
    }
  })

  it('draft can only transition to pending_checks', () => {
    expect(VALID_TRANSITIONS['draft']).toEqual(['pending_checks'])
  })

  it('pending_review can transition to approved or rejected', () => {
    expect(VALID_TRANSITIONS['pending_review']).toEqual(['approved', 'rejected'])
  })

  it('approved can transition to suspended or superseded', () => {
    expect(VALID_TRANSITIONS['approved']).toEqual(['suspended', 'superseded'])
  })
})

describe('ReviewRiskLevel', () => {
  it('accepts all valid risk levels', () => {
    const levels: ReviewRiskLevel[] = ['low', 'medium', 'high', 'critical']
    expect(levels).toHaveLength(4)
  })
})

describe('FindingType', () => {
  it('accepts all valid finding types', () => {
    const types: FindingType[] = ['safety', 'security', 'policy', 'compliance']
    expect(types).toHaveLength(4)
  })
})

describe('FindingSeverity', () => {
  it('accepts all valid severities', () => {
    const severities: FindingSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
    expect(severities).toHaveLength(5)
  })
})

describe('ActiveRegistryApp', () => {
  it('has correct shape', () => {
    const entry: ActiveRegistryApp = {
      app_id: 'uuid-1',
      version_id: 'uuid-2',
      display_name: 'Test App',
      display_description: 'A test application',
      display_category: 'education',
      tools: [{ name: 'test_tool', description: 'A test tool', inputSchema: {} }],
      entry_url: 'http://localhost:5173',
      allowed_origin: 'http://localhost:5173',
      activated_at: '2026-04-02T00:00:00Z',
    }
    expect(entry.app_id).toBe('uuid-1')
    expect(entry.display_description).toBe('A test application')
    expect(entry.tools).toHaveLength(1)
  })

  it('allows null for optional fields', () => {
    const entry: ActiveRegistryApp = {
      app_id: 'uuid-1',
      version_id: 'uuid-2',
      display_name: 'Test App',
      display_description: null,
      display_category: null,
      tools: [],
      entry_url: 'http://localhost:5173',
      allowed_origin: 'http://localhost:5173',
      activated_at: '2026-04-02T00:00:00Z',
    }
    expect(entry.display_description).toBeNull()
    expect(entry.display_category).toBeNull()
  })
})

describe('DiffChange', () => {
  it('has correct shape for added field', () => {
    const change: DiffChange = {
      path: 'permissions.camera',
      kind: 'added',
      old_value: null,
      new_value: 'camera',
      risk_category: 'critical',
      risk_reason: 'New permission added',
    }
    expect(change.kind).toBe('added')
    expect(change.risk_category).toBe('critical')
  })
})
