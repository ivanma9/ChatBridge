import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBridgeClientSession } from '../../src/auth/BridgeClientSession.js'
import { bridgeClientAuth } from '../../src/admin/authMiddleware.js'

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
}

describe('bridgeClientAuth', () => {
  beforeEach(() => {
    process.env.BRIDGE_TOKEN_SECRET = 'test-bridge-token-secret'
  })

  it('attaches the bridge client id for valid tokens', () => {
    const session = createBridgeClientSession()
    const req = {
      headers: {
        authorization: `Bearer ${session.token}`,
      },
    } as Request & { bridgeClientId?: string }
    const res = createResponse()
    const next = vi.fn() as NextFunction

    bridgeClientAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.bridgeClientId).toBe(session.client_id)
  })

  it('rejects missing tokens', () => {
    const req = { headers: {} } as Request
    const res = createResponse()
    const next = vi.fn() as NextFunction

    bridgeClientAuth(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
