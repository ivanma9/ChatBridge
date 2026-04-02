# Implementation Plan: App Onboarding, Version Review, and Registry Eligibility

**Branch**: `001-app-onboarding-review` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-app-onboarding-review/spec.md`

## Summary

Build a bridge-owned trust and registry workflow that gates third-party app access for K-12 users. Internal reviewers submit app manifests, the system runs automated safety/security/policy checks and generates version diffs, reviewers manually approve or reject, and only approved versions are projected into the active registry that powers Chatbox tool discovery and invocation. Every app version is an independent review unit. The bridge currently uses in-memory stores; this plan introduces PostgreSQL for durable review state while keeping in-memory caches for hot-path registry reads.

## Technical Context

**Language/Version**: TypeScript 5.x (aligned with existing bridge and chatbox)
**Primary Dependencies**: Express 4.x (bridge, existing), Kysely (new, type-safe query builder), pg (PostgreSQL driver), deep-diff (manifest comparison)
**Storage**: PostgreSQL 15+ (new for review entities), in-memory cache (existing, retained for registry reads)
**Testing**: Vitest (integration and contract tests), curl/httpie for manual E2E during v1
**Target Platform**: Web — Express server (bridge), Electron/React (chatbox)
**Project Type**: Multi-package platform (bridge service + shared SDK + host shell + demo apps)
**Performance Goals**: Diff generation < 10s (SC-005), registry reads < 100ms
**Constraints**: 7-year audit retention (FERPA), COPPA/FERPA-informed policy checks, internal-only v1
**Scale/Scope**: < 100 apps, single reviewer role, low-frequency submissions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Thin Host, Separate Bridge
**Status**: PASS
- All review, approval, version governance, and registry projection logic lives in `bridge/`.
- Chatbox gains only a thin `BridgeRegistryAdapter` that fetches from `/api/registry/active`.
- No review logic, submission state, or approval workflow touches Chatbox code.

### II. Contract-First Integration
**Status**: PASS
- New shared types (`ApprovalStatus`, `ReviewRiskLevel`, `ActiveRegistryApp`, `AppLaunchRequest/Response`) added to `packages/app-sdk/src/contracts.ts`.
- All bridge-to-chatbox communication uses typed contracts from app-sdk.
- Admin API contracts are documented but bridge-internal (not exposed to chatbox).

### III. Isolated State Ownership
**Status**: PASS
- Review state (submissions, findings, decisions) is bridge-owned in PostgreSQL.
- Registry state is a bridge-owned projection table read by Chatbox.
- Chat transcript state remains Chatbox-owned.
- App internal state remains app-owned.
- Session pinning (chat_session → pinned_version) is bridge-owned.

### IV. Security-First Embedding
**Status**: PASS
- Only approved, non-suspended versions enter the registry. All other states are invisible to Chatbox and apps.
- Suspension immediately removes from registry.
- Session pinning prevents mid-session version swaps.
- Third-party apps are never modified by the approval workflow — the bridge operates on submitted manifests only.

### V. Deterministic, Observable Tool Mediation
**Status**: PASS
- Every review produces structured ReviewFindings with type, severity, and affected path.
- Every decision records reviewer identity, rationale, timestamp, and findings considered.
- Complete version history is retained per app for 7 years.
- Registry mutations (insert/update/delete) are traceable to specific approval or suspension events.

### Development Workflow Gates
**Status**: PASS
1. Start with shared contracts in `packages/app-sdk/` → new review types ✓
2. Add bridge runtime implementation → review service, automated checks, registry projection ✓
3. Keep Chatbox changes thin → only registry adapter and version notification ✓
4. Demo apps prove the lifecycle → submit mock-app manifest through review flow ✓

## Project Structure

### Documentation (this feature)

```text
specs/001-app-onboarding-review/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── submission-api.md
│   ├── registry-api.md
│   ├── diff-contract.md
│   └── app-sdk-types.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/app-sdk/
├── src/
│   └── contracts.ts          # Extended with review types, ActiveRegistryApp, session types

bridge/
├── src/
│   ├── auth/                 # Existing OAuth (unchanged)
│   ├── runtime/              # Existing PostMessageBridge (unchanged)
│   ├── registry/
│   │   ├── AppRegistry.ts    # Modified: reads from registry_entries table, caches in memory
│   │   └── localApps.ts      # Modified: becomes a DB seed script
│   ├── orchestration/        # Existing ToolOrchestrator (unchanged)
│   ├── persistence/
│   │   └── AppSessionStore.ts  # Modified: adds DB backing for session pinning
│   ├── db/                   # NEW: database layer
│   │   ├── connection.ts     # Kysely instance and connection pool
│   │   ├── migrations/       # SQL migration files
│   │   │   └── 001_review_tables.ts
│   │   ├── repositories/     # Typed query functions per entity
│   │   │   ├── appRepository.ts
│   │   │   ├── submissionRepository.ts
│   │   │   ├── findingRepository.ts
│   │   │   └── registryRepository.ts
│   │   └── seed.ts           # Development seed data
│   ├── review/               # NEW: review workflow
│   │   ├── SubmissionService.ts    # Create, validate, lifecycle transitions
│   │   ├── AutomatedCheckPipeline.ts  # Check runner framework
│   │   ├── checks/           # Individual check implementations
│   │   │   ├── ManifestSchemaCheck.ts
│   │   │   ├── PermissionPolicyCheck.ts
│   │   │   ├── OriginAllowlistCheck.ts
│   │   │   ├── ScopeExpansionCheck.ts
│   │   │   └── ContentPolicyCheck.ts
│   │   ├── DiffGenerator.ts        # Manifest version comparison
│   │   ├── RiskAssessor.ts         # Aggregate risk level from diff + findings
│   │   └── ReviewDecisionService.ts  # Approve/reject + registry projection
│   ├── admin/                # NEW: admin API routes
│   │   ├── submissionRoutes.ts
│   │   ├── registryRoutes.ts
│   │   └── historyRoutes.ts
│   └── index.ts              # Modified: mount new routes, init DB

bridge/tests/
├── integration/
│   ├── submission-lifecycle.test.ts
│   ├── update-diff-review.test.ts
│   ├── registry-projection.test.ts
│   ├── session-pinning.test.ts
│   └── concurrency.test.ts
└── unit/
    ├── DiffGenerator.test.ts
    ├── RiskAssessor.test.ts
    └── checks/*.test.ts

chatbox/src/
├── adapters/
│   └── BridgeRegistryAdapter.ts    # NEW: thin REST client for /api/registry/active
└── [minimal integration changes]

apps/
├── mock-app/    # Existing, unchanged — used as test fixture manifest
├── chess/       # Existing, unchanged
├── weather/     # Existing, unchanged
└── spotify/     # Existing, unchanged
```

**Structure Decision**: Existing multi-package layout (`bridge/`, `packages/app-sdk/`, `chatbox/`, `apps/`) is preserved. New code goes into `bridge/src/review/`, `bridge/src/db/`, and `bridge/src/admin/` modules. Chatbox gains a single adapter file. Apps directory is untouched — demo app manifests are submitted through the admin API as test data.

## Key Design Decisions

### How First-Time Onboarding Differs from Update Re-Review

- **Detection**: When a submission is created, the bridge matches `manifest.id` against existing Apps. If no App exists → new app (first-time). If an App exists with an approved version → update.
- **First-time**: Creates new App + AppVersion + AppSubmission. No diff generated. `is_update = false`, `prior_approved_version_id = null`. Risk level determined solely by automated check findings.
- **Update**: Creates new AppVersion + AppSubmission linked to existing App. Generates diff against `prior_approved_version_id`. `is_update = true`. Risk level determined by both diff risk classification AND automated check findings (whichever is higher).

### How Diffs Are Generated Against the Last Approved Version

1. On submission creation for an update, the bridge identifies the most recently approved, non-suspended AppVersion for the same App.
2. `DiffGenerator` performs a recursive structural comparison of the two manifest JSONB objects.
3. Each changed path is classified against the risk sensitivity map (see `contracts/diff-contract.md`).
4. The `DiffResult` (changes, risk categories, summary counts) is stored on `AppSubmission.diff_result`.
5. Automated checks receive the diff as input context and can reference it in their findings.

### How Risk-Based Review Escalates

- Each changed manifest field maps to a risk category (critical / elevated / standard).
- The `RiskAssessor` aggregates: any critical change → high/critical overall; any elevated → medium overall; all standard → low.
- Automated check findings also have severity levels. The final `ReviewRiskLevel` is the max of diff-derived risk and findings-derived risk.
- The reviewer UI surfaces the risk level prominently and highlights critical/elevated changes.

### How Suspension and Rollback Affect the Active Registry

- **Suspension**: Reviewer calls `POST /api/admin/versions/:id/suspend`. Bridge transitions status to `suspended` (terminal), DELETEs the RegistryEntry for that app. If no other approved version exists, the app disappears from discovery.
- **Rollback safety**: Rejecting a v2 update does NOT touch v1's approved status or RegistryEntry. The `WHERE status IN ('pending_checks', 'pending_review')` constraint ensures only one review is active per app, preventing race conditions.
- **Supersede**: When v2 is approved, bridge atomically: (1) INSERT/UPDATE RegistryEntry to v2, (2) UPDATE v1 status to `superseded`. Both in a single DB transaction.

### How Registry Projection Powers Chat Discovery

- `registry_entries` is a dedicated table containing ONLY active approved versions.
- Chatbox calls `GET /api/registry/active` which queries ONLY this table.
- The bridge never exposes submission, finding, or decision data through registry endpoints.
- RegistryEntry contains denormalized display metadata and tool schemas for fast reads.
- In-memory AppRegistry caches registry_entries rows and refreshes on mutations.

### How the Architecture Avoids Modifying Third-Party Apps

- The review workflow operates on **submitted manifests** — JSON declarations of what an app claims about itself.
- Approval or rejection changes the bridge's registry state, not the app's code.
- Apps in `apps/` are never modified by the review process. Their manifests are extracted and submitted through the admin API.
- An app only becomes discoverable when its submitted manifest version passes review. The app itself is oblivious to the review process.

## Complexity Tracking

No constitution violations to justify. All design decisions align with the five constitution principles and workspace boundaries.
