import type { ChatBridgeAppManifest } from '../../../packages/app-sdk/src/contracts'
import * as registryRepo from '../db/repositories/registryRepository.js'

export class AppRegistry {
  private manifests = new Map<string, ChatBridgeAppManifest>()
  private dbEnabled = false

  register(manifest: ChatBridgeAppManifest): void {
    this.manifests.set(manifest.id, manifest)
  }

  get(appId: string): ChatBridgeAppManifest | undefined {
    return this.manifests.get(appId)
  }

  list(): ChatBridgeAppManifest[] {
    return Array.from(this.manifests.values())
  }

  async loadFromDb(): Promise<void> {
    try {
      const entries = await registryRepo.listActiveRegistry()
      for (const entry of entries) {
        const manifest = {
          id: entry.app_id,
          version: entry.version_id,
          name: entry.display_name,
          description: entry.display_description || '',
          entryUrl: entry.entry_url,
          origin: entry.allowed_origin,
          permissions: [],
          scopes: [],
          tools: entry.tool_schemas as any[],
        } satisfies ChatBridgeAppManifest
        this.manifests.set(entry.app_id, manifest)
      }
      this.dbEnabled = true
    } catch {
      // DB not available — keep in-memory only
    }
  }

  async refreshFromDb(): Promise<void> {
    if (this.dbEnabled) {
      this.manifests.clear()
      await this.loadFromDb()
    }
  }
}
