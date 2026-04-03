import crypto from 'node:crypto'

const DEFAULT_TTL_MS = 60 * 60 * 1000
const RENEWAL_BUFFER_MS = 60 * 1000
const CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface BridgeClientSessionPayload {
  client_id: string
  exp: number
}

export interface BridgeClientSession {
  token: string
  client_id: string
  expires_at: number
}

function getBridgeTokenSecret(): string {
  return process.env.BRIDGE_TOKEN_SECRET || process.env.BRIDGE_API_KEY || 'dev-bridge-token-secret'
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getBridgeTokenSecret()).update(payload).digest('base64url')
}

export function isValidClientId(value: string | null | undefined): value is string {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value)
}

export function createBridgeClientSession(clientId?: string, ttlMs = DEFAULT_TTL_MS): BridgeClientSession {
  const client_id = isValidClientId(clientId) ? clientId : crypto.randomUUID()
  const expires_at = Date.now() + ttlMs
  const payload = toBase64Url(JSON.stringify({ client_id, exp: expires_at } satisfies BridgeClientSessionPayload))
  const signature = signPayload(payload)

  return {
    token: `${payload}.${signature}`,
    client_id,
    expires_at,
  }
}

export function verifyBridgeClientToken(token: string): BridgeClientSessionPayload | null {
  if (!token || typeof token !== 'string') {
    return null
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return null
  }

  const expected = signPayload(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as BridgeClientSessionPayload
    if (!isValidClientId(decoded.client_id)) {
      return null
    }
    if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now()) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

export function shouldRefreshBridgeClientSession(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - now <= RENEWAL_BUFFER_MS
}

export function getBridgeClientTokenFromHeaders(headers: Record<string, unknown>): string | null {
  const authHeader = headers.authorization
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7).trim()
  return token || null
}
