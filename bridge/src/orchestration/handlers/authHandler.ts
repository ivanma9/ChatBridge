import { registerToolHandler } from '../ToolMediator.js'
import type { ToolRequest } from '../ToolMediator.js'
import { spotifyAuthBroker } from '../../auth/spotifyBroker.js'

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
    const clientId = request.client_id

    if (request.tool_name.includes('disconnect')) {
      if (appId === 'spotify' && clientId) {
        spotifyAuthBroker.disconnect('spotify', clientId)
      }

      return {
        status: 'disconnected',
        scopes: [],
        message: 'Disconnected from service',
      }
    }

    // For connect/auth requests, return the OAuth start URL
    // The bridge has provider-specific OAuth routes mounted at /auth/:provider/*
    // For now, we derive the provider from the app's scopes
    return {
      status: 'connecting',
      scopes: m?.scopes || [],
      authStartPath: '/auth/spotify/start',
      authStatusPath: '/auth/spotify/status',
      message: `Auth flow initiated for ${appId}. Open the provider authorization window to authenticate.`,
    }
  },
})
