import { useCallback, useEffect, useState } from 'react'
import { bridgeSurfaceStore, useBridgeSurfaceStore } from '../stores/bridgeSurfaceStore'
import { BRIDGE_URL } from '../config'
import { bridgeFetch, ensureBridgeClientSession } from '../bridgeClient'

export interface ActiveRegistryApp {
  app_id: string
  version_id: string
  display_name: string
  display_description: string | null
  display_category: string | null
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
  entry_url: string
  allowed_origin: string
  activated_at: string
}

const POLL_INTERVAL = 60_000

// Stable chat session ID for the current browser session
let chatSessionId: string | null = null
function getChatSessionId(): string {
  if (!chatSessionId) {
    // Check sessionStorage first (persists across page reloads within the same tab)
    chatSessionId = sessionStorage.getItem('bridge_chat_session_id')
    if (!chatSessionId) {
      chatSessionId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem('bridge_chat_session_id', chatSessionId)
    }
  }
  return chatSessionId
}

export function useBridgeApps() {
  const [apps, setApps] = useState<ActiveRegistryApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchApps = useCallback(async () => {
    try {
      const res = await bridgeFetch(`${BRIDGE_URL}/api/registry/active`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setApps(data.apps || [])
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setApps([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApps()
    const interval = setInterval(fetchApps, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchApps])

  return { apps, loading, error, refetch: fetchApps }
}

export function useLaunchApp() {
  const activeAppId = useBridgeSurfaceStore((s) => s.activeAppId)

  const launch = useCallback(async (app: ActiveRegistryApp, toolInput?: Record<string, unknown>) => {
    await ensureBridgeClientSession()

    // Show the app immediately
    bridgeSurfaceStore.getState().setActiveApp({
      activeAppId: app.app_id,
      activeAppName: app.display_name,
      activeAppSessionId: undefined,
      toolInput,
    })

    // Launch or resume session via bridge
    try {
      const res = await bridgeFetch(`${BRIDGE_URL}/api/sessions/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_session_id: getChatSessionId(),
          app_id: app.app_id,
        }),
      })

      const data = await res.json()

      if (res.ok || res.status === 409) {
        // 200 = new session, 409 = existing session returned
        bridgeSurfaceStore.getState().setActiveApp({
          activeAppId: app.app_id,
          activeAppName: app.display_name,
          activeAppSessionId: data.app_session_id,
          toolInput,
        })
      }
    } catch {
      // best-effort
    }
  }, [])

  const close = useCallback(() => {
    bridgeSurfaceStore.getState().clearActiveApp()
  }, [])

  return { launch, close, activeAppId }
}
