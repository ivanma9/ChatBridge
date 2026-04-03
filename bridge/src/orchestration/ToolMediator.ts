import * as registryRepo from '../db/repositories/registryRepository.js'
import { getDb } from '../db/connection.js'

export interface ToolRequest {
  app_id: string
  session_id?: string
  client_id?: string
  tool_name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  tool_name: string
  result: unknown
  handled_by: 'bridge' | 'passthrough'
}

interface ToolHandler {
  match: (appId: string, toolName: string, manifest: unknown) => boolean
  execute: (request: ToolRequest, manifest: unknown) => Promise<unknown>
}

const handlers: ToolHandler[] = []

export function registerToolHandler(handler: ToolHandler): void {
  handlers.push(handler)
}

export async function executeToolRequest(request: ToolRequest): Promise<ToolResult> {
  const { app_id, tool_name, args, session_id } = request

  // 1. Look up app in registry
  const entry = await registryRepo.findRegistryEntry(app_id)
  if (!entry) {
    return { success: false, tool_name, result: { error: 'App not found in registry' }, handled_by: 'bridge' }
  }

  // 2. Get the manifest from the version
  const version = await getDb()
    .selectFrom('app_versions')
    .selectAll()
    .where('id', '=', entry.version_id)
    .executeTakeFirst()

  const manifest = version?.manifest as any

  // 3. Validate tool exists in manifest or is a built-in bridge tool
  const manifestTools = (manifest?.tools || []) as Array<{ name: string }>
  const declaredScopes = (manifest?.scopes || []) as string[]
  const declaredPermissions = (manifest?.permissions || []) as string[]

  const isManifestTool = manifestTools.some((t) => t.name === tool_name)
  const isAuthTool = tool_name.startsWith('auth:') || tool_name.includes('_auth')
  const isBridgeBuiltin = tool_name.startsWith('bridge:')

  if (!isManifestTool && !isAuthTool && !isBridgeBuiltin) {
    await logToolExecution(request, 'rejected', 'Tool not declared in manifest')
    return { success: false, tool_name, result: { error: `Tool "${tool_name}" not declared in app manifest` }, handled_by: 'bridge' }
  }

  // 4. Route to registered handler
  for (const handler of handlers) {
    if (handler.match(app_id, tool_name, manifest)) {
      try {
        const result = await handler.execute(request, manifest)
        await logToolExecution(request, 'success', null)
        return { success: true, tool_name, result, handled_by: 'bridge' }
      } catch (err) {
        await logToolExecution(request, 'error', (err as Error).message)
        return { success: false, tool_name, result: { error: (err as Error).message }, handled_by: 'bridge' }
      }
    }
  }

  // 5. No handler matched — passthrough (app handles it client-side)
  await logToolExecution(request, 'passthrough', null)
  return {
    success: true,
    tool_name,
    result: { passthrough: true, message: `Tool "${tool_name}" acknowledged by bridge. App should handle locally.` },
    handled_by: 'passthrough',
  }
}

async function logToolExecution(
  request: ToolRequest,
  status: 'success' | 'error' | 'rejected' | 'passthrough',
  error: string | null
): Promise<void> {
  try {
    await getDb()
      .insertInto('tool_executions' as any)
      .values({
        app_id: request.app_id,
        session_id: request.session_id || null,
        client_id: request.client_id || null,
        tool_name: request.tool_name,
        args: JSON.stringify(request.args),
        status,
        error,
        executed_at: new Date(),
      } as any)
      .execute()
  } catch {
    // Log table might not exist yet — silently skip
    console.debug(`[tool-mediator] ${status}: ${request.app_id}/${request.tool_name}`)
  }
}
