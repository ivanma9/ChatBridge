import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDb } from './db/connection.js'
import { adminAuth } from './admin/authMiddleware.js'
import { submissionRouter } from './admin/submissionRoutes.js'
import { decisionRouter } from './admin/decisionRoutes.js'
import { registryRouter } from './admin/registryRoutes.js'
import { historyRouter } from './admin/historyRoutes.js'

const PORT = parseInt(process.env.PORT || '3300', 10)

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Initialize database
let dbReady = false
try {
  initDb()
  dbReady = true
  console.log('[bridge] Database connection initialized')
} catch (err) {
  console.warn('[bridge] Database not configured — review features disabled.', (err as Error).message)
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: dbReady })
})

// Review & registry routes (require DB)
if (dbReady) {
  app.use('/api/admin/submissions', adminAuth, submissionRouter)
  app.use('/api/admin', adminAuth, decisionRouter)
  app.use('/api/admin/apps', adminAuth, historyRouter)
  app.use('/api/registry', registryRouter)
  app.use('/api', registryRouter)
}

app.listen(PORT, () => {
  console.log(`[bridge] Server running on port ${PORT}`)
  if (dbReady) {
    console.log(`[bridge] Admin API: http://localhost:${PORT}/api/admin/`)
    console.log(`[bridge] Registry API: http://localhost:${PORT}/api/registry/active`)
  }
})
