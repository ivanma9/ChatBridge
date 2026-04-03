import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBridgeClientSession,
  getBridgeClientTokenFromHeaders,
  isValidClientId,
  shouldRefreshBridgeClientSession,
  verifyBridgeClientToken,
} from '../../src/auth/BridgeClientSession.js'

describe('BridgeClientSession', () => {
  beforeEach(() => {
    process.env.BRIDGE_TOKEN_SECRET = 'test-bridge-token-secret'
  })

  it('creates a signed session token with a valid client id', () => {
    const session = createBridgeClientSession()

    expect(isValidClientId(session.client_id)).toBe(true)
    expect(session.token).toContain('.')
    expect(verifyBridgeClientToken(session.token)).toEqual({
      client_id: session.client_id,
      exp: session.expires_at,
    })
  })

  it('reuses an existing valid client id', () => {
    const first = createBridgeClientSession()
    const second = createBridgeClientSession(first.client_id)

    expect(second.client_id).toBe(first.client_id)
    expect(verifyBridgeClientToken(second.token)?.client_id).toBe(first.client_id)
  })

  it('rejects tampered tokens', () => {
    const session = createBridgeClientSession()
    const [payload] = session.token.split('.')
    const tampered = `${payload}.invalid-signature`

    expect(verifyBridgeClientToken(tampered)).toBeNull()
  })

  it('extracts bearer tokens from request headers', () => {
    const session = createBridgeClientSession()

    expect(
      getBridgeClientTokenFromHeaders({
        authorization: `Bearer ${session.token}`,
      })
    ).toBe(session.token)
  })

  it('treats near-expiry sessions as refreshable', () => {
    const now = 1_000_000

    expect(shouldRefreshBridgeClientSession(now + 30_000, now)).toBe(true)
    expect(shouldRefreshBridgeClientSession(now + 120_000, now)).toBe(false)
  })
})
