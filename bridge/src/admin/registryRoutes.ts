import { Router } from 'express'
import * as registryRepo from '../db/repositories/registryRepository.js'
import type { ActiveRegistryApp } from '../../../../packages/app-sdk/src/contracts.js'

export const registryRouter = Router()

// GET /api/registry/active — List all active registry entries
registryRouter.get('/active', async (_req, res) => {
  try {
    const entries = await registryRepo.listActiveRegistry()
    const apps: ActiveRegistryApp[] = entries.map((e) => ({
      app_id: e.app_id,
      version_id: e.version_id,
      display_name: e.display_name,
      display_description: e.display_description,
      display_category: e.display_category,
      tools: e.tool_schemas as any[],
      entry_url: e.entry_url,
      allowed_origin: e.allowed_origin,
      activated_at: e.activated_at.toISOString(),
    }))
    res.json({ apps })
  } catch (err) {
    console.error('[registry] List active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/registry/active/:appId — Get single active entry
registryRouter.get('/active/:appId', async (req, res) => {
  try {
    const entry = await registryRepo.findRegistryEntry(req.params.appId)
    if (!entry) {
      res.status(404).json({ error: 'No active registry entry for this app' })
      return
    }

    const app: ActiveRegistryApp = {
      app_id: entry.app_id,
      version_id: entry.version_id,
      display_name: entry.display_name,
      display_description: entry.display_description,
      display_category: entry.display_category,
      tools: entry.tool_schemas as any[],
      entry_url: entry.entry_url,
      allowed_origin: entry.allowed_origin,
      activated_at: entry.activated_at.toISOString(),
    }
    res.json(app)
  } catch (err) {
    console.error('[registry] Get active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/sessions/launch — Launch app in chat session (pins version)
registryRouter.post('/sessions/launch', async (req, res) => {
  try {
    const { chat_session_id, app_id } = req.body
    if (!chat_session_id || !app_id) {
      res.status(400).json({ error: 'chat_session_id and app_id are required' })
      return
    }

    // Check for existing session
    const existing = await registryRepo.findAppSessionByChatAndApp(chat_session_id, app_id)
    if (existing) {
      const entry = await registryRepo.findRegistryEntry(app_id)
      if (!entry) {
        res.status(404).json({ error: 'No active registry entry for this app' })
        return
      }
      res.status(409).json({
        app_session_id: existing.id,
        pinned_version_id: existing.pinned_version_id,
        app: {
          app_id: entry.app_id,
          version_id: entry.version_id,
          display_name: entry.display_name,
          display_description: entry.display_description,
          display_category: entry.display_category,
          tools: entry.tool_schemas as any[],
          entry_url: entry.entry_url,
          allowed_origin: entry.allowed_origin,
          activated_at: entry.activated_at.toISOString(),
        },
      })
      return
    }

    // Get active registry entry
    const entry = await registryRepo.findRegistryEntry(app_id)
    if (!entry) {
      res.status(404).json({ error: 'No active registry entry for this app' })
      return
    }

    // Create session pinned to current version
    const session = await registryRepo.createAppSession({
      chat_session_id,
      app_id,
      pinned_version_id: entry.version_id,
    })

    res.json({
      app_session_id: session.id,
      pinned_version_id: session.pinned_version_id,
      app: {
        app_id: entry.app_id,
        version_id: entry.version_id,
        display_name: entry.display_name,
        display_description: entry.display_description,
        display_category: entry.display_category,
        tools: entry.tool_schemas as any[],
        entry_url: entry.entry_url,
        allowed_origin: entry.allowed_origin,
        activated_at: entry.activated_at.toISOString(),
      },
    })
  } catch (err) {
    console.error('[sessions] Launch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/sessions/:appSessionId/status — Session status with version update check
registryRouter.get('/sessions/:appSessionId/status', async (req, res) => {
  try {
    const session = await registryRepo.findAppSession(req.params.appSessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const entry = await registryRepo.findRegistryEntry(session.app_id)
    const currentActiveVersionId = entry?.version_id || session.pinned_version_id

    res.json({
      app_session_id: session.id,
      chat_session_id: session.chat_session_id,
      app_id: session.app_id,
      pinned_version_id: session.pinned_version_id,
      current_active_version_id: currentActiveVersionId,
      version_update_available: currentActiveVersionId !== session.pinned_version_id,
    })
  } catch (err) {
    console.error('[sessions] Status error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
