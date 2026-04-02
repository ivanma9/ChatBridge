# Quickstart: Local Development

**Branch**: `001-app-onboarding-review` | **Date**: 2026-04-02

## Prerequisites

- Node.js 18+ (check `.node-version` in chatbox/)
- PostgreSQL 15+ running locally
- pnpm (for chatbox/) and npm (for bridge/)

## Database Setup

```bash
# Create the development database
createdb chatbridge_dev

# Set the connection string in bridge/.env
echo 'DATABASE_URL=postgresql://localhost:5432/chatbridge_dev' >> bridge/.env

# Run migrations (after implementation)
cd bridge && npm run db:migrate
```

## Package Startup Order

### 1. Shared Contracts (`packages/app-sdk/`)

Build shared types first since both bridge and chatbox depend on them.

```bash
cd packages/app-sdk
npm install
npm run build    # compiles TypeScript contracts
```

Changes to `contracts.ts` require rebuilding and restarting consumers.

### 2. Bridge (`bridge/`)

The platform layer — runs the review workflow, automated checks, and registry.

```bash
cd bridge
npm install
cp .env.example .env   # edit DATABASE_URL if needed

# Run migrations
npm run db:migrate

# Seed development data (pre-approved test apps)
npm run db:seed

# Start the bridge server
npm run dev            # starts on port 3300 (existing default)
```

**Key URLs**:
- Admin API: `http://localhost:3300/api/admin/...`
- Registry API: `http://localhost:3300/api/registry/active`
- OAuth callback: `http://localhost:3300/callback` (existing)

### 3. Chatbox (`chatbox/`)

The host shell — only consumes the active registry.

```bash
cd chatbox
pnpm install
pnpm dev               # starts Electron dev mode
```

Chatbox reads from `http://localhost:3300/api/registry/active` to discover available apps.

### 4. Demo Apps (`apps/`)

Third-party app fixtures for testing the review flow.

```bash
# Mock app (existing)
cd apps/mock-app && npm run dev     # port 5173

# Chess (existing)
cd apps/chess && npm run dev        # port 5174

# Weather (existing)
cd apps/weather                     # static files

# Spotify (existing)
cd apps/spotify && npm run dev      # port 5175
```

Demo apps are NOT modified by the review workflow. Their manifests are submitted through the admin API for review.

## Development Workflows

### Submitting a Test App for Review

```bash
# 1. Create a submission with the mock-app manifest
curl -X POST http://localhost:3300/api/admin/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "manifest": {
      "id": "mock-app",
      "version": "1.0.0",
      "name": "Quiz Mock App",
      "description": "A quiz app for testing",
      "entryUrl": "http://localhost:5173",
      "origin": "http://localhost:5173",
      "permissions": [],
      "scopes": [],
      "tools": [{"name": "quiz_start", "description": "Start a quiz", "inputSchema": {}}]
    },
    "metadata": {
      "vendor_name": "ChatBridge Dev Team",
      "category": "education"
    }
  }'

# 2. Initiate review (validates manifest, runs automated checks)
curl -X POST http://localhost:3300/api/admin/submissions/{id}/initiate-review

# 3. View findings
curl http://localhost:3300/api/admin/submissions/{id}

# 4. Approve
curl -X POST http://localhost:3300/api/admin/submissions/{id}/decide \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "approved",
    "rationale": "Test app meets all safety requirements",
    "findings_considered": []
  }'

# 5. Verify it appears in the active registry
curl http://localhost:3300/api/registry/active
```

### Testing an Update Review

```bash
# Submit a new version of the same app with expanded permissions
curl -X POST http://localhost:3300/api/admin/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "manifest": {
      "id": "mock-app",
      "version": "1.1.0",
      "name": "Quiz Mock App",
      "description": "A quiz app for testing - now with camera",
      "entryUrl": "http://localhost:5173",
      "origin": "http://localhost:5173",
      "permissions": ["camera"],
      "scopes": ["student_name"],
      "tools": [{"name": "quiz_start", "description": "Start a quiz", "inputSchema": {}}]
    },
    "metadata": { "vendor_name": "ChatBridge Dev Team" }
  }'

# The response will show is_update: true and prior_approved_version_id
# After initiating review, the diff_result will show the added permission and scope
```

### Testing a Rejection

```bash
# Submit an app with suspicious permissions, then reject it
# After rejection, verify it does NOT appear in /api/registry/active
```

### Testing Suspension

```bash
# Suspend a previously approved version
curl -X POST http://localhost:3300/api/admin/versions/{id}/suspend \
  -H 'Content-Type: application/json' \
  -d '{"rationale": "Security vulnerability discovered"}'

# Verify it was removed from /api/registry/active
```

## Testing Strategy

### Contract Tests (`packages/app-sdk/`)
- Validate that shared types match expected shapes
- Ensure enum values are exhaustive

### Integration Tests (`bridge/`)
- Full submission lifecycle: draft → pending_checks → pending_review → approved
- Rejection flow: draft → ... → rejected → verify not in registry
- Update flow: submit v2 → verify diff generated → verify risk escalation
- Suspension flow: approved → suspended → verify registry removal
- Concurrency: two concurrent submissions for same app → second rejected with 409
- Session pinning: launch session → approve new version → verify session still pinned

### End-to-End Tests
- Submit → approve → verify discoverable in chatbox registry adapter
- Submit → reject → verify NOT discoverable
- Submit v1 → approve → submit v2 → approve → verify v1 superseded, v2 active
- Submit v1 → approve → submit v2 → reject → verify v1 still active

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | (required) | PostgreSQL connection string |
| PORT | 3300 | Bridge server port |
| ADMIN_API_KEY | (required) | API key for admin endpoint access |
| SPOTIFY_CLIENT_ID | (optional) | Spotify OAuth (existing) |
| SPOTIFY_CLIENT_SECRET | (optional) | Spotify OAuth (existing) |
