import crypto from 'node:crypto'

export type AppOAuthState = 'disconnected' | 'connecting' | 'connected' | 'expired'

export interface AppAuthSnapshot {
  appId: string
  state: AppOAuthState
  grantedScopes: string[]
  updatedAt: number
}

export interface TokenRecord {
  accessToken: string
  refreshToken: string
  expiresAt: number
  grantedScopes: string[]
}

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
}

interface PendingAuth {
  appId: string
  state: string
  createdAt: number
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

export class AppAuthBroker {
  private snapshots = new Map<string, AppAuthSnapshot>()
  private tokens = new Map<string, TokenRecord>()
  private pendingAuths = new Map<string, PendingAuth>() // keyed by state param
  private oauthConfig: OAuthConfig | null = null

  configureOAuth(config: OAuthConfig): void {
    this.oauthConfig = config
  }

  getSnapshot(appId: string): AppAuthSnapshot | undefined {
    return this.snapshots.get(appId)
  }

  setSnapshot(snapshot: AppAuthSnapshot): void {
    this.snapshots.set(snapshot.appId, snapshot)
  }

  clearSnapshot(appId: string): void {
    this.snapshots.delete(appId)
  }

  // -- OAuth flow methods ---------------------------------------------

  beginOAuth(appId: string): string {
    if (!this.oauthConfig) throw new Error('OAuth not configured')

    const state = crypto.randomBytes(16).toString('hex')
    this.pendingAuths.set(state, { appId, state, createdAt: Date.now() })

    this.setSnapshot({
      appId,
      state: 'connecting',
      grantedScopes: [],
      updatedAt: Date.now()
    })

    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      response_type: 'code',
      redirect_uri: this.oauthConfig.redirectUri,
      scope: this.oauthConfig.scopes.join(' '),
      state
    })

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`
  }

  async handleCallback(code: string, state: string): Promise<AppAuthSnapshot> {
    if (!this.oauthConfig) throw new Error('OAuth not configured')

    const pending = this.pendingAuths.get(state)
    if (!pending) throw new Error('Invalid or expired state parameter')

    this.pendingAuths.delete(state)

    // Exchange authorization code for tokens
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.oauthConfig.redirectUri
    })

    const authHeader = Buffer.from(
      `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
    ).toString('base64')

    const res = await fetch(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`
      },
      body: body.toString()
    })

    if (!res.ok) {
      const errText = await res.text()
      this.setSnapshot({
        appId: pending.appId,
        state: 'disconnected',
        grantedScopes: [],
        updatedAt: Date.now()
      })
      throw new Error(`Token exchange failed: ${errText}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      scope: string
    }

    const grantedScopes = data.scope ? data.scope.split(' ') : []

    this.tokens.set(pending.appId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      grantedScopes
    })

    const snapshot: AppAuthSnapshot = {
      appId: pending.appId,
      state: 'connected',
      grantedScopes,
      updatedAt: Date.now()
    }
    this.setSnapshot(snapshot)

    return snapshot
  }

  handleCallbackError(error: string, state: string): void {
    const pending = this.pendingAuths.get(state)
    if (pending) {
      this.pendingAuths.delete(state)
      this.setSnapshot({
        appId: pending.appId,
        state: 'disconnected',
        grantedScopes: [],
        updatedAt: Date.now()
      })
    }
  }

  async getValidAccessToken(appId: string): Promise<string> {
    const record = this.tokens.get(appId)
    if (!record) throw new Error('No token stored for app: ' + appId)

    if (Date.now() >= record.expiresAt - REFRESH_BUFFER_MS) {
      await this.refreshAccessToken(appId)
      const refreshed = this.tokens.get(appId)
      if (!refreshed) throw new Error('Token refresh failed for app: ' + appId)
      return refreshed.accessToken
    }

    return record.accessToken
  }

  async refreshAccessToken(appId: string): Promise<void> {
    if (!this.oauthConfig) throw new Error('OAuth not configured')

    const record = this.tokens.get(appId)
    if (!record) throw new Error('No token to refresh for app: ' + appId)

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken
    })

    const authHeader = Buffer.from(
      `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
    ).toString('base64')

    const res = await fetch(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`
      },
      body: body.toString()
    })

    if (!res.ok) {
      // Refresh failed — mark as expired
      this.setSnapshot({
        appId,
        state: 'expired',
        grantedScopes: record.grantedScopes,
        updatedAt: Date.now()
      })
      this.tokens.delete(appId)
      throw new Error('Token refresh failed')
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }

    const grantedScopes = data.scope ? data.scope.split(' ') : record.grantedScopes

    this.tokens.set(appId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || record.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      grantedScopes
    })

    this.setSnapshot({
      appId,
      state: 'connected',
      grantedScopes,
      updatedAt: Date.now()
    })
  }

  disconnect(appId: string): void {
    this.tokens.delete(appId)
    this.snapshots.delete(appId)
  }
}
