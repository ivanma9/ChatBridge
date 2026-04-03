import type { ChatBridgeAppManifest, ChatBridgeToolManifest } from '../../../packages/app-sdk/src'

export interface ToolResolution {
  toolName: string
  appId: string
  manifest: ChatBridgeToolManifest
}

export class ToolOrchestrator {
  private toolIndex = new Map<string, ToolResolution>()

  registerApp(manifest: ChatBridgeAppManifest): void {
    for (const tool of manifest.tools) {
      this.toolIndex.set(tool.name, {
        toolName: tool.name,
        appId: manifest.id,
        manifest: tool,
      })
    }
  }

  resolve(toolName: string): ToolResolution | undefined {
    return this.toolIndex.get(toolName)
  }

  list(): ToolResolution[] {
    return Array.from(this.toolIndex.values())
  }
}
