import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppAuthBroker } from '../../src/auth/AppAuthBroker.js'

describe('AppAuthBroker', () => {
  let broker: AppAuthBroker

  beforeEach(() => {
    broker = new AppAuthBroker()
    broker.configureOAuth({
      clientId: 'spotify-client',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3300/auth/spotify/callback',
      authorizationUrl: 'https://accounts.spotify.com/authorize',
      tokenUrl: 'https://accounts.spotify.com/api/token',
      scopes: ['playlist-read-private'],
    })
    vi.restoreAllMocks()
  })

  it('tracks snapshots independently per bridge client', () => {
    broker.setSnapshot({
      appId: 'spotify',
      clientId: 'client-a',
      state: 'connected',
      grantedScopes: ['playlist-read-private'],
      updatedAt: Date.now(),
    })
    broker.setSnapshot({
      appId: 'spotify',
      clientId: 'client-b',
      state: 'disconnected',
      grantedScopes: [],
      updatedAt: Date.now(),
    })

    expect(broker.getSnapshot('spotify', 'client-a')?.state).toBe('connected')
    expect(broker.getSnapshot('spotify', 'client-b')?.state).toBe('disconnected')
  })

  it('stores OAuth results under the client that started the flow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: 'playlist-read-private',
      }),
    }))

    const url = broker.beginOAuth('spotify', 'client-a')
    const state = new URL(url).searchParams.get('state')
    expect(state).toBeTruthy()

    await broker.handleCallback('auth-code', state || '')

    expect(broker.getSnapshot('spotify', 'client-a')?.state).toBe('connected')
    expect(broker.getSnapshot('spotify', 'client-b')).toBeUndefined()
    await expect(broker.getValidAccessToken('spotify', 'client-a')).resolves.toBe('access-token')
    await expect(broker.getValidAccessToken('spotify', 'client-b')).rejects.toThrow('No token stored')
  })
})
