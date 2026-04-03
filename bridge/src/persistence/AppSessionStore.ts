export interface AppSessionRecord {
  id: string
  chatSessionId: string
  appId: string
  status: 'idle' | 'active' | 'completed' | 'failed'
  state: Record<string, unknown>
  summary?: string
  updatedAt: number
}

export class AppSessionStore {
  private sessions = new Map<string, AppSessionRecord>()

  get(appSessionId: string): AppSessionRecord | undefined {
    return this.sessions.get(appSessionId)
  }

  upsert(record: AppSessionRecord): void {
    this.sessions.set(record.id, record)
  }

  listByChatSession(chatSessionId: string): AppSessionRecord[] {
    return Array.from(this.sessions.values()).filter((session) => session.chatSessionId === chatSessionId)
  }
}
