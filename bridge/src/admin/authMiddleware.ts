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
