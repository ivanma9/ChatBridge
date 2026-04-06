import type { CorsOptions } from 'cors'

const DEFAULT_ALLOWED_ORIGINS = [
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

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = splitOrigins(env.CHATBRIDGE_ALLOWED_ORIGINS || env.BRIDGE_ALLOWED_ORIGINS)
  return configured.length > 0 ? configured : [...DEFAULT_ALLOWED_ORIGINS]
}

export function isAllowedCorsOrigin(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin || origin === 'null') {
    return true
  }

  return getAllowedCorsOrigins(env).includes(origin)
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
