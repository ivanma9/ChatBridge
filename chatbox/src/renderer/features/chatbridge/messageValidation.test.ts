import { describe, expect, it } from 'vitest'
import { isBridgeEnvelope, isTrustedBridgeEnvelope } from './messageValidation'

const VALID_ENVELOPE = {
  protocolVersion: '1' as const,
  appSessionId: 'session-123',
  nonce: 'nonce-123',
  event: {
    type: 'app:ready',
    payload: {
      appId: 'spotify',
      version: '0.1.0',
    },
  },
}

describe('messageValidation', () => {
  it('recognizes a valid bridge envelope', () => {
    expect(isBridgeEnvelope(VALID_ENVELOPE)).toBe(true)
  })

  it('rejects an envelope from the wrong origin', () => {
    expect(
      isTrustedBridgeEnvelope({
        data: VALID_ENVELOPE,
        origin: 'https://evil.example.com',
        expectedOrigin: 'https://spotify.example.com',
        source: {},
        expectedSource: {},
        expectedSessionId: 'session-123',
        expectedNonce: 'nonce-123',
      })
    ).toBe(false)
  })

  it('rejects an envelope from the wrong window source', () => {
    const expectedSource = {}
    expect(
      isTrustedBridgeEnvelope({
        data: VALID_ENVELOPE,
        origin: 'https://spotify.example.com',
        expectedOrigin: 'https://spotify.example.com',
        source: {},
        expectedSource,
        expectedSessionId: 'session-123',
        expectedNonce: 'nonce-123',
      })
    ).toBe(false)
  })

  it('rejects an envelope with the wrong nonce', () => {
    expect(
      isTrustedBridgeEnvelope({
        data: VALID_ENVELOPE,
        origin: 'https://spotify.example.com',
        expectedOrigin: 'https://spotify.example.com',
        source: {},
        expectedSource: {},
        expectedSessionId: 'session-123',
        expectedNonce: 'nonce-mismatch',
      })
    ).toBe(false)
  })

  it('rejects an envelope with the wrong app session id', () => {
    expect(
      isTrustedBridgeEnvelope({
        data: VALID_ENVELOPE,
        origin: 'https://spotify.example.com',
        expectedOrigin: 'https://spotify.example.com',
        source: {},
        expectedSource: {},
        expectedSessionId: 'session-other',
        expectedNonce: 'nonce-123',
      })
    ).toBe(false)
  })
})
