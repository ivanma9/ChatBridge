import { ActionIcon, Box, Flex, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { bridgeFetch } from '../bridgeClient'
import { buildAppUrl } from '../buildAppUrl'
import { doesEntryUrlMatchAllowedOrigin } from '../originValidation'
import { useBridgeSurfaceStore } from '../stores/bridgeSurfaceStore'
import { useBridgeApps, useLaunchApp } from '../hooks/useBridgeApps'
import { BRIDGE_URL } from '../config'

export function EmbeddedBridgeSurface() {
  const activeAppId = useBridgeSurfaceStore((s) => s.activeAppId)
  const activeAppName = useBridgeSurfaceStore((s) => s.activeAppName)
  const activeAppSessionId = useBridgeSurfaceStore((s) => s.activeAppSessionId)
  const toolInput = useBridgeSurfaceStore((s) => s.toolInput)
  const { close } = useLaunchApp()
  const { apps } = useBridgeApps()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initSent = useRef(false)
  const authPollTimerRef = useRef<number | null>(null)

  const activeApp = apps.find((a) => a.app_id === activeAppId)
  const hasApprovedOrigin = activeApp
    ? doesEntryUrlMatchAllowedOrigin(activeApp.entry_url, activeApp.allowed_origin)
    : false

  // Reset init guard when app changes
  useEffect(() => {
    initSent.current = false
  }, [activeAppId, activeAppSessionId])

  useEffect(() => {
    if (!activeApp || !iframeRef.current || !hasApprovedOrigin || !activeAppSessionId) return

    const stopAuthPolling = () => {
      if (authPollTimerRef.current !== null) {
        window.clearInterval(authPollTimerRef.current)
        authPollTimerRef.current = null
      }
    }

    const sendToApp = (event: { type: string; payload: unknown }) => {
      if (!iframeRef.current?.contentWindow) {
        return
      }

      // Send bare { type, payload } — apps don't need to implement envelope parsing.
      // Security is enforced by targetOrigin on send and origin+source check on receive.
      iframeRef.current.contentWindow.postMessage(event, activeApp.allowed_origin)
    }

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
        sendToApp({ type: 'host:resume-session', payload: { appSessionId: activeAppSessionId, state: savedState } })
      } else {
        sendToApp({
          type: 'host:init',
          payload: {
            appId: activeApp.app_id,
            appSessionId: activeAppSessionId,
            chatSessionId: `chat-${Date.now()}`,
            input: toolInput || {},
          },
        })

        // Send default auth state (disconnected) so apps can show connect screen
        setTimeout(() => {
          sendToApp({ type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } })
        }, 100)

        if (toolInput && Object.keys(toolInput).length > 0) {
          setTimeout(() => {
            sendToApp({ type: 'host:tool-result', payload: { toolName: 'init', result: toolInput } })
          }, 200)
        }
      }
    }

    const startAuthPolling = (statusPath: string) => {
      stopAuthPolling()
      authPollTimerRef.current = window.setInterval(async () => {
        try {
          const res = await bridgeFetch(`${BRIDGE_URL}${statusPath}`)
          if (!res.ok) {
            stopAuthPolling()
            sendToApp({ type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } })
            return
          }

          const authState = await res.json()
          sendToApp({ type: 'host:auth-state', payload: authState })

          if (authState.status !== 'connecting') {
            stopAuthPolling()
          }
        } catch {
          stopAuthPolling()
        }
      }, 1000)
    }

    const openAuthWindow = async (toolName: string, startPath: string, statusPath: string) => {
      try {
        const response = await bridgeFetch(`${BRIDGE_URL}${startPath}`, {
          method: 'POST',
        })
        if (!response.ok) {
          sendToApp({
            type: 'host:tool-result',
            payload: { toolName, result: { error: 'Could not start the authorization flow.' } },
          })
          sendToApp({ type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } })
          return
        }

        const data = await response.json()
        if (typeof data.url === 'string' && data.url) {
          window.open(data.url, 'chatbridge-auth', 'width=500,height=700')
          startAuthPolling(statusPath)
          return
        }

        sendToApp({
          type: 'host:tool-result',
          payload: { toolName, result: { error: 'Authorization provider did not return a launch URL.' } },
        })
        sendToApp({ type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } })
      } catch {
        stopAuthPolling()
        sendToApp({
          type: 'host:tool-result',
          payload: { toolName, result: { error: 'Could not open the authorization window.' } },
        })
        sendToApp({ type: 'host:auth-state', payload: { status: 'disconnected', scopes: [] } })
      }
    }

    const handler = (event: MessageEvent) => {
      // Accept bare { type, payload } messages from the trusted iframe.
      // Security: check origin matches the registered allowed_origin and the
      // message came from this specific iframe (not another frame on the page).
      if (event.origin !== activeApp.allowed_origin) return
      if (event.source !== iframeRef.current?.contentWindow) return

      const data = event.data as { type: string; payload: any }
      if (!data || typeof data.type !== 'string') return

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
            sendToApp({ type: 'host:tool-result', payload: { toolName, result: response.result } })
            // If the result contains auth state, forward that too
            if (response.result?.status && (toolName.includes('auth') || toolName.includes('connect'))) {
              sendToApp({ type: 'host:auth-state', payload: response.result })
            }
            if (response.result?.authStartPath && response.result?.authStatusPath) {
              void openAuthWindow(toolName, response.result.authStartPath, response.result.authStatusPath)
            }
          })
          .catch(() => {
            sendToApp({ type: 'host:tool-result', payload: { toolName, result: { error: 'Tool request failed' } } })
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
      stopAuthPolling()
      window.removeEventListener('message', handler)
      iframe.removeEventListener('load', onLoad)
    }
  }, [activeApp, activeAppSessionId, hasApprovedOrigin, toolInput])

  if (!activeAppId || !activeApp || !activeAppSessionId) {
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
      {hasApprovedOrigin ? (
        <iframe
          ref={iframeRef}
          src={buildAppUrl(activeApp.entry_url, toolInput)}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
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
      ) : (
        <Box p="md">
          <Text size="sm" c="red" fw={600}>Blocked app origin mismatch</Text>
          <Text size="xs" c="dimmed" mt={4}>
            The registered app entry URL does not match its approved origin, so ChatBridge refused to mount it.
          </Text>
        </Box>
      )}
    </Box>
  )
}
