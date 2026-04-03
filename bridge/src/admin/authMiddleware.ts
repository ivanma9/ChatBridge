import type { Request, Response, NextFunction } from 'express'

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-admin-key']
  const expectedKey = process.env.ADMIN_API_KEY

  if (!expectedKey) {
    res.status(500).json({ error: 'ADMIN_API_KEY not configured' })
    return
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing X-Admin-Key header' })
    return
  }

  next()
}

export function bridgeAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.BRIDGE_API_KEY

  // Dev mode: if no key is configured, allow all requests through
  if (!expectedKey) {
    next()
    return
  }

  const headerKey = req.headers['x-bridge-key']
  const authHeader = req.headers['authorization']
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  const provided = headerKey || bearerToken

  if (!provided || provided !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing X-Bridge-Key header' })
    return
  }

  next()
}
