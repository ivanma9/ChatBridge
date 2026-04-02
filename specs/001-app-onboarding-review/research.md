# Research: App Onboarding, Version Review, and Registry Eligibility

**Branch**: `001-app-onboarding-review` | **Date**: 2026-04-02

## R1: PostgreSQL Integration for Bridge

**Decision**: Add PostgreSQL to the bridge service, replacing in-memory stores for review/approval entities while keeping the existing in-memory AppRegistry as a read-through cache backed by the DB.

**Rationale**: The bridge currently uses in-memory Maps for app registry, sessions, and auth state. The review workflow requires durable storage with 7-year retention, audit trails, and transactional state transitions. PostgreSQL is the specified persistence layer and is well-suited for the relational entity model (App → AppVersion → AppSubmission → ReviewFinding/ReviewDecision → RegistryEntry).

**Alternatives considered**:
- SQLite: Simpler setup but lacks concurrent access support needed for multi-reviewer scenarios and doesn't scale to production deployment.
- Keep in-memory + JSON files: No transactional guarantees, no query capability for audit, doesn't meet 7-year retention requirements.
- MongoDB: Document model is tempting for manifests but relational integrity (FK constraints, status transition enforcement) is better served by PostgreSQL.

**Implementation approach**:
- Use a lightweight query builder (Kysely) rather than a full ORM. Kysely provides type-safe SQL, migration support, and avoids the abstraction overhead of Prisma/TypeORM while keeping the bridge layer thin.
- Bridge service adds a `db/` module with migrations, connection pool, and typed repository functions.
- Existing in-memory AppRegistry becomes a cache layer that reads from the `registry_entries` table (active approved versions only).

---

## R2: Manifest Diff Generation

**Decision**: Implement structural JSON diff at the bridge layer using a deep-diff utility, with domain-aware categorization of changes into risk tiers.

**Rationale**: The spec requires diffing manifest permissions, scopes, origins, tools, and UI metadata between versions (FR-009, FR-010). A structural diff captures added/removed/changed fields, and domain-aware categorization maps changes to risk levels (e.g., new permission = high risk, changed display name = low risk).

**Alternatives considered**:
- Text-based diff (like git diff on serialized JSON): Produces noisy output, hard to categorize by risk, poor UX for reviewers.
- Schema-level diff (compare JSON schemas): Over-engineered for v1 where manifests are concrete objects, not dynamic schemas.
- Manual reviewer comparison: Defeats the purpose of automated escalation.

**Implementation approach**:
- Use `deep-diff` or a custom recursive comparator to produce a list of `{path, kind, lhs, rhs}` change records.
- Classify each change path against a risk-sensitivity map:
  - **Critical**: `permissions`, `scopes`, `origins` → escalate to `high` or `critical` risk level
  - **Elevated**: `tools` (added/removed), `entryUrl`, external URLs → escalate to `medium` or `high`
  - **Standard**: `name`, `description`, `version`, UI display metadata → `low` risk
- Aggregate change classifications into the overall ReviewRiskLevel for the submission.
- Store the diff as a structured JSON record on the AppSubmission for reviewer consumption.

---

## R3: Automated Check Framework

**Decision**: Implement automated checks as a configurable pipeline of check functions that run sequentially against a submission and produce ReviewFindings.

**Rationale**: The spec requires automated safety, security, and policy checks (FR-005, FR-006) that produce structured findings. V1 is internal-first, so the check pipeline can be a simple in-process function chain rather than a distributed job system. Checks must be retryable (FR-008).

**Alternatives considered**:
- External check service (separate microservice): Over-engineered for v1 internal use. Can be extracted later.
- Webhook-based checks (post to external validators): Adds deployment complexity without v1 benefit.
- Manual-only checks (no automation): Violates spec requirement for mixed automated + manual.

**Implementation approach**:
- Define a `ReviewCheck` interface: `(submission: AppSubmission, version: AppVersion, priorApproved?: AppVersion) => Promise<ReviewFinding[]>`.
- Ship v1 with these built-in checks:
  1. **Manifest schema validator** — validates required fields, types, and structure.
  2. **Permission policy checker** — flags dangerous or K-12 inappropriate permission requests.
  3. **Origin allowlist checker** — validates origins against known-safe patterns, flags unknown origins.
  4. **Scope expansion detector** — for updates, flags any new scopes not present in prior approved version.
  5. **Content policy checker** — basic metadata/description scanning for policy violations.
- Each check returns one or more ReviewFindings with type, severity, and description.
- The pipeline runner aggregates findings, assigns the max severity as the ReviewRiskLevel, and transitions the submission to `pending_review`.
- If any check throws (infrastructure failure), the submission stays in `pending_checks` and the reviewer is notified.

---

## R4: Session Pinning Strategy

**Decision**: Pin chat sessions to a specific app version ID at session start time, resolved from the active RegistryEntry. Serve version-specific metadata from the registry snapshot.

**Rationale**: FR-023 requires sessions to remain on their starting version. The simplest approach is to record `active_version_id` when a chat session launches an app, and resolve all subsequent tool calls and iframe loads against that pinned version rather than the current registry head.

**Alternatives considered**:
- Re-resolve version on every tool call: Violates session pinning requirement.
- Serve all versions and let the app self-select: Violates security-first embedding principle.

**Implementation approach**:
- When Chatbox launches an app in a chat session, the bridge records `(chatSessionId, appId, pinnedVersionId)` in the app session store.
- All subsequent tool invocations and iframe loads for that app in that session use the pinned version's manifest (entry URL, tool schemas, permissions).
- When the pinned version is superseded, the bridge includes a `version_update_available: true` flag in session metadata, which Chatbox can render as a notification.
- Session pinning is a bridge concern; Chatbox simply passes through the session ID.

---

## R5: Registry Projection for Chat Discovery

**Decision**: The active registry is a materialized view — a dedicated `registry_entries` table that contains only currently active approved versions. Chatbox queries this table exclusively.

**Rationale**: FR-016 through FR-018 require strict separation between the full submission catalog and the active registry. A materialized/projection table ensures Chatbox can never accidentally see non-approved data, even with query bugs. It also enables fast reads without filtering across all submissions.

**Alternatives considered**:
- Filtered query on submissions table (WHERE status = 'approved' AND NOT suspended): Risky — query bugs could leak non-approved versions. Also slower for high-frequency discovery queries.
- Separate registry microservice: Over-engineered for v1.

**Implementation approach**:
- `registry_entries` table with columns: `app_id`, `version_id`, `activated_at`, `display_metadata` (JSON).
- On approval: INSERT/UPSERT into registry_entries (one row per app).
- On suspension: DELETE from registry_entries where app_id matches.
- On supersede: UPDATE registry_entries to point to new version_id.
- Chatbox reads ONLY from `registry_entries`. Bridge API exposes a `/registry/active` endpoint that queries this table.
- The submissions table, findings, decisions, and review history are accessible only through bridge-internal admin endpoints.

---

## R6: Migration from In-Memory to PostgreSQL

**Decision**: Incremental migration — add PostgreSQL for new review/approval entities, keep existing in-memory patterns as cache layers that warm from DB on startup.

**Rationale**: The existing bridge uses in-memory Maps for AppRegistry, AppSessionStore, and auth state. Ripping out in-memory entirely would break the existing demo apps. Instead, the in-memory AppRegistry becomes a read cache for the registry_entries table, and new entities (submissions, findings, decisions) are DB-only from the start.

**Alternatives considered**:
- Full replacement of all in-memory stores: High risk of breaking existing functionality, unnecessary for v1.
- Dual-write to both memory and DB: Complex and error-prone.

**Implementation approach**:
1. Add Kysely + pg driver to bridge dependencies.
2. Create migration files for all new tables.
3. Add a `db/` module with connection pool, typed queries, and repository functions.
4. Modify AppRegistry to load from `registry_entries` on startup and refresh on mutation events.
5. Existing `localApps.ts` becomes a seed/fixture file for development that inserts pre-approved test apps.
6. AppSessionStore gains a DB backing for session pinning records.

---

## R7: Chatbox Integration Layer

**Decision**: Chatbox consumes the bridge's active registry via a thin REST client adapter, not direct DB access. The adapter fetches from `/registry/active` and transforms into the format Chatbox's tool discovery UI expects.

**Rationale**: Constitution principle I (Thin Host) requires Chatbox changes to be minimal integration adapters. Chatbox should not know about submissions, reviews, or approval logic — only about which apps and tools are currently available.

**Alternatives considered**:
- SSE stream from bridge to Chatbox for real-time registry updates: Useful but not required for v1 where the registry changes infrequently (internal reviewers only).
- Direct DB read from Chatbox: Violates Thin Host principle and leaks bridge internals.

**Implementation approach**:
- Bridge exposes `GET /registry/active` → returns `RegistryEntry[]` with display metadata and tool schemas.
- Chatbox adds a `BridgeRegistryAdapter` in its adapter layer that fetches and caches this endpoint.
- On chat session start with an app, Chatbox calls `POST /sessions/launch` with `{chatSessionId, appId}` → bridge returns pinned version info.
- Version update notifications come via existing session metadata polling or SSE channel.
