import express from 'express'
import cors from 'cors'
import { getDb } from './db/connection.js'

const PROXY_PORT = parseInt(process.env.APP_PROXY_PORT || '3301', 10)

const proxyApp = express()
proxyApp.use(cors({ origin: true }))

proxyApp.use('/:appId', async (req, res) => {
  try {
    const entry = await getDb()
      .selectFrom('registry_entries')
      .selectAll()
      .where('app_id', '=', req.params.appId)
      .executeTakeFirst()

    if (!entry) {
      res.status(404).json({ error: 'App not found' })
      return
    }

    const subPath = req.originalUrl.replace(`/${req.params.appId}`, '') || '/'
    const targetUrl = new URL(subPath, entry.entry_url).toString()

    const appResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Accept: req.headers['accept'] || '*/*',
        'Accept-Encoding': req.headers['accept-encoding'] || 'identity',
      },
    })

    const contentType = appResponse.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.status(appResponse.status)
    res.send(Buffer.from(await appResponse.arrayBuffer()))
  } catch (err) {
    console.error('[app-proxy] Error:', err)
    res.status(502).json({ error: 'Proxy error' })
  }
})

export function startAppProxyServer() {
  proxyApp.listen(PROXY_PORT, () => {
    console.log(`[bridge] App proxy running on port ${PROXY_PORT}`)
  })
}
