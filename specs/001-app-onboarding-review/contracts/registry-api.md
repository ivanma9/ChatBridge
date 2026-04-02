# Contract: Active Registry API

**Owner**: `bridge/`  
**Consumers**: `chatbox/` (via BridgeRegistryAdapter)

This is the ONLY bridge API surface that Chatbox consumes. It exposes exclusively approved, non-suspended versions.

## Endpoints

### GET /api/registry/active

Returns all currently active app versions in the registry for chat discovery.

**Response (200)**:
```typescript
{
  apps: ActiveRegistryApp[]
}

interface ActiveRegistryApp {
  app_id: string
  version_id: string
  display_name: string
  display_description: string | null
  display_category: string | null
  tools: ChatBridgeToolManifest[]    // from app-sdk
  entry_url: string
  allowed_origin: string
  activated_at: string               // ISO 8601
}
```

**Caching**: Response may be cached for up to 60 seconds by the client. Registry mutations are infrequent in v1 (internal-only reviewers).

**Security**: This endpoint does NOT return submission details, findings, review history, or any non-approved version data.

---

### GET /api/registry/active/:appId

Returns a single active app entry by app ID.

**Response (200)**: Single `ActiveRegistryApp` object.

**Errors**:
- `404` — no active registry entry for this app (either not approved, suspended, or doesn't exist)

---

### POST /api/sessions/launch

Launch an app within a chat session. Pins the session to the currently active version.

**Request**:
```typescript
{
  chat_session_id: string
  app_id: string
}
```

**Response (200)**:
```typescript
{
  app_session_id: string
  pinned_version_id: string
  app: ActiveRegistryApp              // snapshot of the active version at launch time
}
```

**Errors**:
- `404` — no active registry entry for this app
- `409` — session already has an active launch for this app (return existing session)

---

### GET /api/sessions/:appSessionId/status

Check session status including version update availability.

**Response (200)**:
```typescript
{
  app_session_id: string
  chat_session_id: string
  app_id: string
  pinned_version_id: string
  current_active_version_id: string     // may differ from pinned
  version_update_available: boolean     // true if current_active != pinned
}
```

## Shared Types (from packages/app-sdk)

The following types are consumed by both bridge and chatbox:

```typescript
// Existing - already in app-sdk contracts.ts
interface ChatBridgeAppManifest { ... }
interface ChatBridgeToolManifest { ... }

// New - to be added to app-sdk
interface ActiveRegistryApp {
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
```
