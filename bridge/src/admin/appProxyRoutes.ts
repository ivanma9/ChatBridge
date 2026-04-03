import { Router } from 'express'
import * as registryRepo from '../db/repositories/registryRepository.js'
import { AppProxyTargetError, extractProxySubPath, resolveApprovedAppTarget } from './appProxyTarget.js'

export const appProxyRouter = Router()

// GET /apps/:appId/* — Reverse proxy to the app's entry_url
// This serves app content through the bridge origin so iframes work without cross-origin issues
appProxyRouter.use('/:appId', async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ error: 'App proxy only supports GET and HEAD requests' })
      return
    }

    const entry = await registryRepo.findRegistryEntry(req.params.appId)
    if (!entry) {
      res.status(404).json({ error: 'App not found in registry' })
      return
    }

    // Build the target URL: entry_url + the sub-path after /apps/:appId
    const subPath = extractProxySubPath(req.originalUrl, req.params.appId, '/apps')
    const targetUrl = resolveApprovedAppTarget(entry.entry_url, entry.allowed_origin, subPath)

    // Fetch from the actual app server
    const appResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Encoding': req.headers['accept-encoding'] || 'identity',
      },
    })

    // Forward status and content-type
    const contentType = appResponse.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.status(appResponse.status)

    // Stream the body
    const buffer = Buffer.from(await appResponse.arrayBuffer())
    res.send(buffer)
  } catch (err) {
    if (err instanceof AppProxyTargetError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error(`[proxy] Error proxying to app ${req.params.appId}:`, err)
    res.status(502).json({ error: 'Failed to proxy to app' })
  }
})
