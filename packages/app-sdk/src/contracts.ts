export interface ChatBridgeToolManifest {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ChatBridgeAppManifest {
  id: string
  version: string
  name: string
  description: string
  entryUrl: string
  origin: string
  permissions: string[]
  scopes: string[]
  tools: ChatBridgeToolManifest[]
}

export const CHATBRIDGE_PROTOCOL_VERSION = '1' as const
export type ChatBridgeProtocolVersion = typeof CHATBRIDGE_PROTOCOL_VERSION

export type ChatBridgeHostEventType =
  | 'host:init'
  | 'host:resume-session'
  | 'host:tool-result'
  | 'host:request-complete'
  | 'host:auth-state'

export type ChatBridgeAppEventType =
  | 'app:ready'
  | 'app:resize'
  | 'app:request-tool'
  | 'app:save-state'
  | 'app:complete'
  | 'app:error'

export type ChatBridgeHostEvent =
  | {
      type: 'host:init'
      payload: {
        appId: string
        appSessionId: string
        chatSessionId: string
        input?: Record<string, unknown>
      }
    }
  | {
      type: 'host:resume-session'
      payload: {
        appSessionId: string
        state: Record<string, unknown>
      }
    }
  | {
      type: 'host:tool-result'
      payload: {
        toolName: string
        result: unknown
      }
    }
  | {
      type: 'host:request-complete'
      payload: {
        summary?: string
      }
    }
  | {
      type: 'host:auth-state'
      payload: {
        status: 'disconnected' | 'connecting' | 'connected' | 'expired'
        scopes: string[]
      }
    }

export type ChatBridgeAppEvent =
  | {
      type: 'app:ready'
      payload: {
        appId: string
        version: string
      }
    }
  | {
      type: 'app:resize'
      payload: {
        height: number
      }
    }
  | {
      type: 'app:request-tool'
      payload: {
        toolName: string
        args: Record<string, unknown>
      }
    }
  | {
      type: 'app:save-state'
      payload: {
        state: Record<string, unknown>
      }
    }
  | {
      type: 'app:complete'
      payload: {
        summary: string
        output?: Record<string, unknown>
      }
    }
  | {
      type: 'app:error'
      payload: {
        message: string
      }
    }

export interface ChatBridgeEnvelope<TEvent> {
  protocolVersion: ChatBridgeProtocolVersion
  appSessionId: string
  nonce: string
  event: TEvent
}

// ── Review & Registry Types ─────────────────────────────────────────

/** Lifecycle state of an AppSubmission */
export type ApprovalStatus =
  | 'draft'
  | 'pending_checks'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'superseded'

/** Terminal statuses that cannot transition further */
export const TERMINAL_STATUSES: readonly ApprovalStatus[] = [
  'rejected',
  'suspended',
  'superseded',
] as const

/** Valid status transitions */
export const VALID_TRANSITIONS: Record<string, ApprovalStatus[]> = {
  draft: ['pending_checks'],
  pending_checks: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  approved: ['suspended', 'superseded'],
  rejected: [],
  suspended: [],
  superseded: [],
}

/** Risk level assigned to a submission after automated checks */
export type ReviewRiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** Finding type category */
export type FindingType = 'safety' | 'security' | 'policy' | 'compliance'

/** Finding severity */
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

/** Source of a finding */
export type FindingSource = 'automated' | 'manual'

/** Change context for findings on updates */
export type ChangeContext = 'new_field' | 'changed_field' | 'existing_field'

/** A registry entry representing an active, approved app version.
 *  This is the ONLY type Chatbox uses to discover and launch apps. */
export interface ActiveRegistryApp {
  app_id: string
  version_id: string
  display_name: string
  display_description: string | null
  display_category: string | null
  tools: ChatBridgeToolManifest[]
  entry_url: string
  allowed_origin: string
  activated_at: string
}

/** Request to launch an app within a chat session */
export interface AppLaunchRequest {
  chat_session_id: string
  app_id: string
}

/** Response after launching an app, includes pinned version info */
export interface AppLaunchResponse {
  app_session_id: string
  pinned_version_id: string
  app: ActiveRegistryApp
}

/** Session status including version update notification */
export interface AppSessionStatus {
  app_session_id: string
  chat_session_id: string
  app_id: string
  pinned_version_id: string
  current_active_version_id: string
  version_update_available: boolean
}

/** New host event for version update notification */
export interface HostVersionUpdateEvent {
  type: 'host:version-update-available'
  data: {
    app_id: string
    current_version: string
    new_version: string
  }
}

/** Diff result comparing two manifest versions */
export interface DiffResult {
  prior_version_id: string
  new_version_id: string
  generated_at: string
  overall_risk_level: ReviewRiskLevel
  summary: {
    total_changes: number
    additions: number
    removals: number
    modifications: number
    risk_sensitive_changes: number
  }
  changes: DiffChange[]
}

/** A single change between two manifest versions */
export interface DiffChange {
  path: string
  kind: 'added' | 'removed' | 'modified'
  old_value: unknown | null
  new_value: unknown | null
  risk_category: 'critical' | 'elevated' | 'standard'
  risk_reason: string
}
