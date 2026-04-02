# Contract: App SDK Shared Types

**Owner**: `packages/app-sdk/`  
**Consumers**: `bridge/`, `chatbox/`

New types to be added to `packages/app-sdk/src/contracts.ts` alongside existing event and manifest types.

## New Types

### Review-Related Enums

```typescript
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
  'rejected', 'suspended', 'superseded'
] as const

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
```

### Active Registry Type (consumed by Chatbox)

```typescript
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
  activated_at: string  // ISO 8601
}
```

### Session Launch Types (consumed by Chatbox)

```typescript
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
```

### Host Event Extension

```typescript
/** New host event for version update notification */
export interface HostVersionUpdateEvent {
  type: 'host:version-update-available'
  data: {
    app_id: string
    current_version: string
    new_version: string
  }
}
```

## Existing Types (unchanged)

The following existing types in `contracts.ts` remain unchanged:
- `ChatBridgeAppManifest` — used as-is for manifest storage and validation
- `ChatBridgeToolManifest` — used as-is for tool schema storage
- `ChatBridgeHostEvent` — extended with new event type above
- `ChatBridgeAppEvent` — unchanged

## Package Export

All new types are exported from `packages/app-sdk/src/contracts.ts` and available via:
```typescript
import { ApprovalStatus, ActiveRegistryApp, ... } from '@chatbridge/app-sdk'
```
