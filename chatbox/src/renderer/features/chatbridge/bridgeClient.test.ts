import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeFetch, ensureBridgeClientSession } from './bridgeClient'

function createStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('bridgeClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('window', { sessionStorage: createStorage() })
  })

  it('bootstraps and stores a bridge client session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'signed-token',
        client_id: '11111111-1111-4111-8111-111111111111',
        expires_at: Date.now() + 3600_000,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const session = await ensureBridgeClientSession()

    expect(session?.token).toBe('signed-token')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('attaches the bridge auth header to bridge fetches', async () => {
    const bootstrapResponse = {
      ok: true,
      json: async () => ({
        token: 'signed-token',
        client_id: '11111111-1111-4111-8111-111111111111',
        expires_at: Date.now() + 3600_000,
      }),
    }
    const dataResponse = {
      ok: true,
      json: async () => ({ ok: true }),
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(bootstrapResponse).mockResolvedValueOnce(dataResponse)
    vi.stubGlobal('fetch', fetchMock)

    await bridgeFetch('http://localhost:3300/api/example', {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3300/api/example',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    )

    const headers = fetchMock.mock.calls[1]?.[1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer signed-token')
    expect(headers.get('Content-Type')).toBe('application/json')
  })
})
