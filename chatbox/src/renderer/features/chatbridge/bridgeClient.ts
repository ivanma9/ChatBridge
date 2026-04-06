import { BRIDGE_URL } from './config'

const STORAGE_KEYS = {
  token: 'bridge_client_token',
  clientId: 'bridge_client_id',
  expiresAt: 'bridge_client_expires_at',
} as const

const RENEWAL_BUFFER_MS = 60 * 1000

export interface BridgeClientSession {
  token: string
  client_id: string
  expires_at: number
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function loadStoredSession(): BridgeClientSession | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }

  const token = storage.getItem(STORAGE_KEYS.token)
  const client_id = storage.getItem(STORAGE_KEYS.clientId)
  const expires_at = Number(storage.getItem(STORAGE_KEYS.expiresAt) || '0')

  if (!token || !client_id || !Number.isFinite(expires_at) || expires_at <= 0) {
    return null
  }

  return { token, client_id, expires_at }
}

function storeSession(session: BridgeClientSession): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEYS.token, session.token)
  storage.setItem(STORAGE_KEYS.clientId, session.client_id)
  storage.setItem(STORAGE_KEYS.expiresAt, String(session.expires_at))
}

function clearStoredSession(): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  storage.removeItem(STORAGE_KEYS.token)
  storage.removeItem(STORAGE_KEYS.clientId)
  storage.removeItem(STORAGE_KEYS.expiresAt)
}

function shouldRefresh(expiresAt: number): boolean {
  return expiresAt - Date.now() <= RENEWAL_BUFFER_MS
}

export async function ensureBridgeClientSession(): Promise<BridgeClientSession | null> {
  const stored = loadStoredSession()
  if (stored && !shouldRefresh(stored.expires_at)) {
    return stored
  }

  const response = await fetch(`${BRIDGE_URL}/api/bridge/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: stored?.client_id,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create bridge client session: ${response.status}`)
  }

  const session = (await response.json()) as BridgeClientSession
  storeSession(session)
  return session
}

export async function getBridgeAuthHeaders(): Promise<Record<string, string>> {
  const session = await ensureBridgeClientSession()
  if (!session) {
    return {}
  }

  return {
    Authorization: `Bearer ${session.token}`,
  }
}

export async function bridgeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getBridgeAuthHeaders()
  const headers = new Headers(init.headers || {})

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value)
  }

  const response = await fetch(input, { ...init, headers })

  // On 401, the stored token is stale or was signed by a different server.
  // Clear it and retry once with a freshly-obtained token.
  if (response.status === 401) {
    clearStoredSession()
    const freshAuthHeaders = await getBridgeAuthHeaders()
    const retryHeaders = new Headers(init.headers || {})
    for (const [key, value] of Object.entries(freshAuthHeaders)) {
      retryHeaders.set(key, value)
    }
    return fetch(input, { ...init, headers: retryHeaders })
  }

  return response
}
