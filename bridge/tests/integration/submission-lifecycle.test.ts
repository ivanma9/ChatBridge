import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// These tests require a running PostgreSQL instance
// Run: DATABASE_URL=postgresql://localhost:5432/chatbridge_test npm test

describe('Submission Lifecycle', () => {
  describe('US1: New app submission flow', () => {
    it.todo('should create App + AppVersion + AppSubmission with draft status')
    it.todo('should transition draft → pending_checks → pending_review on initiate-review')
    it.todo('should record findings from automated checks')
    it.todo('should assign a risk level based on findings')
    it.todo('should allow retry when checks fail')
    it.todo('should reject malformed manifest with validation errors')
  })

  describe('US2: Reject unsafe app', () => {
    it.todo('should transition pending_review → rejected on decide(rejected)')
    it.todo('should record ReviewDecision with rationale')
    it.todo('should NOT create a RegistryEntry on rejection')
    it.todo('should keep rejected submission visible in listing')
    it.todo('should prevent further transitions from rejected status')
  })
})
