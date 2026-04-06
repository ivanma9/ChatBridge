import { tool } from 'ai'
import z from 'zod'
import { bridgeSurfaceStore } from '@/features/chatbridge/stores/bridgeSurfaceStore'
import type { ActiveRegistryApp } from '@/features/chatbridge/hooks/useBridgeApps'
import { BRIDGE_URL } from '@/features/chatbridge/config'

let cachedApps: ActiveRegistryApp[] = []
let cacheTime = 0

async function getApps(): Promise<ActiveRegistryApp[]> {
  if (Date.now() - cacheTime < 30_000 && cachedApps.length > 0) {
    return cachedApps
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/api/registry/active`)
    if (!res.ok) return cachedApps
    const data = await res.json()
    cachedApps = data.apps || []
    cacheTime = Date.now()
    return cachedApps
  } catch {
    return cachedApps
  }
}

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  if (!schema || typeof schema !== 'object') {
    return z.object({})
  }

  const props = (schema as any).properties
  if (!props || typeof props !== 'object') {
    return z.object({})
  }

  const required = new Set<string>((schema as any).required || [])
  const shape: Record<string, z.ZodType> = {}

  for (const [key, val] of Object.entries(props)) {
    const prop = val as any
    let zType: z.ZodType = z.string()

    if (prop.type === 'number' || prop.type === 'integer') {
      zType = z.number()
    } else if (prop.type === 'boolean') {
      zType = z.boolean()
    } else {
      zType = z.string()
    }

    if (prop.description) {
      zType = (zType as any).describe(prop.description)
    }

    if (!required.has(key)) {
      zType = zType.optional()
    }

    shape[key] = zType
  }

  return z.object(shape)
}

export async function getBridgeToolSet(): Promise<{
  description: string
  tools: Record<string, ReturnType<typeof tool>>
}> {
  const apps = await getApps()

  if (apps.length === 0) {
    return { description: '', tools: {} }
  }

  const tools: Record<string, ReturnType<typeof tool>> = {}
  const descriptions: string[] = []

  for (const app of apps) {
    for (const appTool of app.tools) {
      const toolName = `bridge_${appTool.name}`

      descriptions.push(
        `## ${toolName}\n${appTool.description} (from ${app.display_name} app). When calling this tool, the ${app.display_name} app will open in a side panel for the user to interact with.`
      )

      tools[toolName] = tool({
        description: `${appTool.description} — opens the ${app.display_name} app. Use this when the user wants to use ${app.display_name}.`,
        inputSchema: jsonSchemaToZod(appTool.inputSchema),
        execute: async (input: Record<string, unknown>) => {
          // Get stable chat session ID
          const chatSessionId = sessionStorage.getItem('bridge_chat_session_id')
            || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          if (!sessionStorage.getItem('bridge_chat_session_id')) {
            sessionStorage.setItem('bridge_chat_session_id', chatSessionId)
          }

          // Launch or resume session via bridge
          bridgeSurfaceStore.getState().setActiveApp({
            activeAppId: app.app_id,
            activeAppName: app.display_name,
            activeAppSessionId: undefined,
            toolInput: input,
          })

          let appSessionId: string | undefined
          try {
            const res = await fetch(`${BRIDGE_URL}/api/sessions/launch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_session_id: chatSessionId, app_id: app.app_id }),
            })
            const data = await res.json()
            if (res.ok || res.status === 409) {
              appSessionId = data.app_session_id
              bridgeSurfaceStore.getState().setActiveApp({
                activeAppId: app.app_id,
                activeAppName: app.display_name,
                activeAppSessionId: appSessionId,
                toolInput: input,
              })
            }
          } catch {
            // best effort
          }

          // Fetch session state so the LLM has app context (board state, scores, etc.)
          let appState: unknown = null
          if (appSessionId) {
            try {
              const stateRes = await fetch(`${BRIDGE_URL}/api/sessions/${appSessionId}/state`)
              if (stateRes.ok) {
                const stateData = await stateRes.json()
                appState = stateData.state
              }
            } catch {
              // best effort
            }
          }

          return {
            success: true,
            message: `${app.display_name} has been opened in the side panel. The user can now interact with it directly.`,
            app_name: app.display_name,
            tool_called: appTool.name,
            input,
            ...(appState ? { app_state: appState } : {}),
          }
        },
      })
    }
  }

  const description = apps.length > 0
    ? `\nYou have access to the following ChatBridge apps that can be launched for the user:\n\n${descriptions.join('\n\n')}\n\nWhen a user asks to use one of these apps, call the appropriate tool to open it.\n`
    : ''

  return { description, tools }
}
