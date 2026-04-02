import { describe, it, expect } from 'vitest'

describe('Registry Projection', () => {
  describe('US3: Approval creates registry entry', () => {
    it.todo('should create RegistryEntry on approve with display metadata')
    it.todo('should include tool schemas in registry entry')
    it.todo('should appear in GET /api/registry/active after approval')
    it.todo('should NOT appear in registry when status is draft/pending/rejected')
  })

  describe('US7: Update approval with supersede', () => {
    it.todo('should replace RegistryEntry when new version approved')
    it.todo('should transition prior version to superseded')
    it.todo('should only show the new version in active registry')
  })
})
