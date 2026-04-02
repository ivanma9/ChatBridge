import { describe, it, expect } from 'vitest'

describe('Update Detection and Diff', () => {
  describe('US4: Update detection', () => {
    it.todo('should detect is_update=true when prior approved version exists')
    it.todo('should set prior_approved_version_id')
    it.todo('should generate diff_result on submission creation')
  })

  describe('US5: Diff review', () => {
    it.todo('should show added permissions in diff')
    it.todo('should escalate risk level for permission expansion')
    it.todo('should classify changes by risk category')
  })

  describe('US6: Rollback safety', () => {
    it.todo('should NOT modify prior version status on v2 rejection')
    it.todo('should keep v1 in active registry after v2 rejection')
    it.todo('should not disrupt active sessions pinned to v1')
  })
})
