import { describe, it, expect } from 'vitest'

describe('Session Pinning', () => {
  describe('US3: Session launch', () => {
    it.todo('should create session pinned to current active version')
    it.todo('should return 404 when no active registry entry exists')
    it.todo('should return existing session on duplicate launch (409)')
  })

  describe('Session status with version update', () => {
    it.todo('should report version_update_available=false when versions match')
    it.todo('should report version_update_available=true when versions differ')
  })
})
