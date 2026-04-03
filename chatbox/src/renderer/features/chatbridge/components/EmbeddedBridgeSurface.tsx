import { ActionIcon, Box, Flex, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { bridgeFetch } from '../bridgeClient'
import { useBridgeSurfaceStore } from '../stores/bridgeSurfaceStore'
import { useBridgeApps, useLaunchApp } from '../hooks/useBridgeApps'
import { BRIDGE_URL } from '../config'

function buildAppUrl(appId: string, directUrl: string, toolInput?: Record<string, unknown>): string {
  const url = new URL(directUrl)
  if (toolInput) {
    for (const [key, value] of Object.entries(toolInput)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export function EmbeddedBridgeSurface() {
  const activeAppId = useBridgeSurfaceStore((s) => s.activeAppId)
  const activeAppName = useBridgeSurfaceStore((s) => s.activeAppName)
  const activeAppSessionId = useBridgeSurfaceStore((s) => s.activeAppSessionId)
  const toolInput = useBridgeSurfaceStore((s) => s.toolInput)
  const { close } = useLaunchApp()
  const { apps } = useBridgeApps()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initSent = useRef(false)

  const activeApp = apps.find((a) => a.app_id === activeAppId)

  // Reset init guard when app changes
  useEffect(() => {
    initSent.current = false
  }, [activeAppId])

  useEffect(() => {
    if (!activeApp || !iframeRef.current) return

    const sendInit = async () => {
      if (initSent.current || !iframeRef.current?.contentWindow) return
      initSent.current = true

      // Check for saved state to resume
      let savedState: unknown = null
      if (activeAppSessionId) {
        try {
          const res = await bridgeFetch(`${BRIDGE_URL}/api/sessions/${activeAppSessionId}/state`)
          if (res.ok) {
            const data = await res.json()
            savedState = data.state
          }
        } catch { /* no saved state */ }
      }

      // Don't resume completed sessions — start fresh
      if (savedState && (savedState as any)?._completed) {
        savedState = null
      }

      if (savedState) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'host:resume-session', payload: { appSessionId: activeAppSessionId, state: savedState } },
          '*'
        )
      } else {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'host:init',
            payload: {
              appId: activeApp.app_id,
              appSessionId: activeAppSessionId || `session-${Date.now()}`,
              chatSessionId: `chat-${Date.now()}`,
              input: toolInput || {},
            },
          },
          '*'
        )

        // Send default auth state (disconnected) so apps can show connect screen
        setTimeout(() => {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } },
            '*'
          )
        }, 100)

        if (toolInput && Object.keys(toolInput).length > 0) {
          setTimeout(() => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'host:tool-result', payload: { toolName: 'init', result: toolInput } },
              '*'
            )
          }, 200)
        }
      }
    }

    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data?.type) return

      if (data.type === 'app:ready') {
        sendInit()
      }

      if (data.type === 'app:resize' && iframeRef.current) {
        iframeRef.current.style.height = `${data.payload.height}px`
      }

      // Generic tool mediation — forward all app:request-tool to bridge
      if (data.type === 'app:request-tool' && data.payload) {
        const { toolName, args } = data.payload
        bridgeFetch(`${BRIDGE_URL}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: activeApp.app_id,
            tool_name: toolName,
            args: args || {},
            session_id: activeAppSessionId,
          }),
        })
          .then((res) => res.json())
          .then((response) => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'host:tool-result', payload: { toolName, result: response.result } },
              '*'
            )
            // If the result contains auth state, forward that too
            if (response.result?.status && (toolName.includes('auth') || toolName.includes('connect'))) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'host:auth-state', payload: response.result },
                '*'
              )
            }
          })
          .catch(() => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'host:tool-result', payload: { toolName, result: { error: 'Tool request failed' } } },
              '*'
            )
          })
      }

      // Persist app state to bridge (debounced, fire-and-forget)
      if (data.type === 'app:save-state' && activeAppSessionId) {
        bridgeFetch(`${BRIDGE_URL}/api/sessions/${activeAppSessionId}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: data.payload.state }),
        }).catch(() => {})
      }

      if (data.type === 'app:complete' && activeAppSessionId) {
        bridgeFetch(`${BRIDGE_URL}/api/sessions/${activeAppSessionId}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: { ...data.payload, _completed: true } }),
        }).catch(() => {})
      }
    }

    window.addEventListener('message', handler)

    const iframe = iframeRef.current
    const onLoad = () => setTimeout(sendInit, 300)
    iframe.addEventListener('load', onLoad)

    return () => {
      window.removeEventListener('message', handler)
      iframe.removeEventListener('load', onLoad)
    }
  }, [activeApp, activeAppSessionId])

  if (!activeAppId || !activeApp) {
    return null
  }

  return (
    <Box
      key={activeAppId}
      style={{
        width: '480px',
        minWidth: '480px',
        height: '100%',
        borderLeft: '1px solid var(--mantine-color-gray-3)',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        px="md"
        py={8}
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          background: 'var(--mantine-color-gray-0)',
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap={8}>
          <Box w={8} h={8} style={{ borderRadius: '50%', background: '#16a34a' }} />
          <Text size="sm" fw={600}>{activeAppName || activeAppId}</Text>
          {toolInput && Object.keys(toolInput).length > 0 && (
            <Text size="xs" c="dimmed">{Object.values(toolInput).join(', ')}</Text>
          )}
        </Flex>
        <ActionIcon variant="subtle" size="sm" onClick={close}>
          <IconX size={14} />
        </ActionIcon>
      </Flex>
      <iframe
        ref={iframeRef}
        src={buildAppUrl(activeApp.app_id, activeApp.entry_url, toolInput)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          flexGrow: 1,
          border: 'none',
          display: 'block',
          overflow: 'visible',
          pointerEvents: 'auto',
          touchAction: 'auto',
          userSelect: 'none',
        }}
        title={activeAppName || 'Bridge App'}
      />
    </Box>
  )
}
