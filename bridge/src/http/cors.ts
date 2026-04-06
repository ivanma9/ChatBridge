import type { CorsOptions } from 'cors'

// Bridge security is enforced via Bearer token auth on each endpoint.
// CORS is left fully open so any origin (Electron, Vercel, local dev) can
// reach the bridge without configuration.  To restrict origins in a
// production deployment, set CHATBRIDGE_BLOCKED_ORIGINS to a
// comma-separated list of origins to explicitly deny.
export function createBridgeCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const blocked = new Set(
    (env.CHATBRIDGE_BLOCKED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  )

  return {
    origin(origin, callback) {
      if (origin && blocked.has(origin)) {
        callback(new Error(`CORS origin blocked: ${origin}`))
        return
      }
      callback(null, true)
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Bridge-Key'],
  }
}
