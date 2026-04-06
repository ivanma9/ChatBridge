import type { CorsOptions } from 'cors'

const LOCAL_ORIGINS = [
  'http://localhost:1212',
  'http://127.0.0.1:1212',
] as const

function splitOrigins(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | null {
  const configured = splitOrigins(env.CHATBRIDGE_ALLOWED_ORIGINS || env.BRIDGE_ALLOWED_ORIGINS)
  // If explicitly configured, use that list; otherwise null means allow all origins
  return configured.length > 0 ? configured : null
}

export function isAllowedCorsOrigin(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin || origin === 'null') {
    return true
  }

  const allowed = getAllowedCorsOrigins(env)
  // No explicit allowlist → allow all origins (Bearer token is the auth layer)
  if (allowed === null) {
    return true
  }

  return allowed.includes(origin) || LOCAL_ORIGINS.includes(origin as typeof LOCAL_ORIGINS[number])
}

export function createBridgeCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  return {
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin, env)) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS origin not allowed: ${origin}`))
    },
    credentials: true,
  }
}
