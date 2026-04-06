import { describe, expect, it } from 'vitest'
import { createBridgeCorsOptions, getAllowedCorsOrigins, isAllowedCorsOrigin } from '../../src/http/cors.js'

describe('bridge CORS', () => {
  it('defaults to the web host origins used by Chatbox development', () => {
    expect(getAllowedCorsOrigins({} as NodeJS.ProcessEnv)).toEqual([
      'http://localhost:1212',
      'http://127.0.0.1:1212',
    ])
  })

  it('allows configured origins only', () => {
    const env = {
      CHATBRIDGE_ALLOWED_ORIGINS: 'https://chat.example.com, https://staging.example.com',
    } as NodeJS.ProcessEnv

    expect(isAllowedCorsOrigin('https://chat.example.com', env)).toBe(true)
    expect(isAllowedCorsOrigin('https://spotify.example.com', env)).toBe(false)
  })

  it('permits requests without an Origin header', () => {
    expect(isAllowedCorsOrigin(undefined, {} as NodeJS.ProcessEnv)).toBe(true)
  })

  it('produces cors options that reject unexpected origins', async () => {
    const env = {
      CHATBRIDGE_ALLOWED_ORIGINS: 'https://chat.example.com',
    } as NodeJS.ProcessEnv
    const options = createBridgeCorsOptions(env)

    const allowed = await new Promise<{ err: Error | null; value?: boolean }>((resolve) => {
      options.origin?.('https://chat.example.com', (err, value) => {
        resolve({ err: err || null, value })
      })
    })
    const denied = await new Promise<{ err: Error | null; value?: boolean }>((resolve) => {
      options.origin?.('https://evil.example.com', (err, value) => {
        resolve({ err: err || null, value })
      })
    })

    expect(allowed.err).toBeNull()
    expect(allowed.value).toBe(true)
    expect(denied.err?.message).toContain('CORS origin not allowed')
  })
})
