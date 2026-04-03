import { registerToolHandler } from '../ToolMediator.js'
import type { ToolRequest } from '../ToolMediator.js'

const BRIDGE_PORT = parseInt(process.env.PORT || '3300', 10)

// Match any auth-related tool request for apps that have scopes
registerToolHandler({
  match: (_appId: string, toolName: string, manifest: unknown) => {
    const m = manifest as any
    const hasScopes = (m?.scopes?.length || 0) > 0

    return hasScopes && (
      toolName.includes('auth') ||
      toolName.includes('connect') ||
      toolName.includes('disconnect') ||
      toolName.startsWith('auth:') ||
      toolName.startsWith('request_')
    )
  },

  execute: async (request: ToolRequest, manifest: unknown) => {
    const m = manifest as any
    const appId = m?.id || request.app_id

    if (request.tool_name.includes('disconnect')) {
      return {
        status: 'disconnected',
        scopes: [],
        message: 'Disconnected from service',
      }
    }

    // For connect/auth requests, return the OAuth start URL
    // The bridge has provider-specific OAuth routes mounted at /auth/:provider/*
    // For now, we derive the provider from the app's scopes
    const authUrl = `http://localhost:${BRIDGE_PORT}/auth/spotify/start`

    return {
      status: 'connecting',
      scopes: m?.scopes || [],
      authUrl,
      message: `Auth flow initiated for ${appId}. Open ${authUrl} to authenticate.`,
    }
  },
})
