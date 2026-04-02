# Tasks: App Onboarding, Version Review, and Registry Eligibility

**Input**: Design documents from `specs/001-app-onboarding-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration and contract tests are included per the spec's testing requirements (contract tests, integration tests for review and registry behavior, end-to-end tests for approve/reject/update flows).

**Organization**: Tasks are grouped by user story. P1 stories (US1, US2, US3) form the MVP. P2 stories (US4–US7) add version update and rollback flows.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and configure build/test tooling for new bridge modules

- [x] T001 Add bridge dependencies: kysely, pg, deep-diff, and their type packages in bridge/package.json
- [x] T002 [P] Add vitest and test configuration for bridge in bridge/vitest.config.ts
- [x] T003 [P] Add new shared type exports to packages/app-sdk/package.json and ensure build script compiles contracts.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database layer, shared contracts, and base repository functions that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add review-related shared types (ApprovalStatus, ReviewRiskLevel, FindingType, FindingSeverity, ActiveRegistryApp, AppLaunchRequest, AppLaunchResponse, AppSessionStatus) to packages/app-sdk/src/contracts.ts per contracts/app-sdk-types.md
- [x] T005 [P] Create Kysely database connection module with connection pool and typed database interface in bridge/src/db/connection.ts
- [x] T006 Create database migration for all review tables (apps, app_versions, app_submissions, review_findings, review_decisions, registry_entries) with enum types and indexes per data-model.md in bridge/src/db/migrations/001_review_tables.ts
- [ ] T007 Run migration and verify all tables, enums, indexes, and constraints are created correctly
- [x] T008 [P] Create repository functions for App and AppVersion CRUD in bridge/src/db/repositories/appRepository.ts
- [x] T009 [P] Create repository functions for AppSubmission CRUD and status transitions with transition validation in bridge/src/db/repositories/submissionRepository.ts
- [x] T010 [P] Create repository functions for ReviewFinding and ReviewDecision CRUD in bridge/src/db/repositories/findingRepository.ts
- [x] T011 [P] Create repository functions for RegistryEntry CRUD (upsert on approve, delete on suspend) in bridge/src/db/repositories/registryRepository.ts
- [x] T012 Mount admin and registry route groups in bridge/src/index.ts with Express Router and initialize DB connection on startup
- [x] T012a Implement basic API key authentication middleware for /api/admin/* routes — validate X-Admin-Key header against ADMIN_API_KEY environment variable, reject unauthorized requests with 401 in bridge/src/admin/authMiddleware.ts
- [x] T012b [P] Add contract tests verifying shared type shapes, enum value exhaustiveness (ApprovalStatus, ReviewRiskLevel), and ActiveRegistryApp interface structure in packages/app-sdk/tests/contracts.test.ts

**Checkpoint**: Database ready, shared types compiled, repositories available, auth middleware in place, route mounting done. User story implementation can begin.

---

## Phase 3: User Story 1 - Onboard a First-Time App (Priority: P1) MVP

**Goal**: A reviewer can submit a new app manifest, have it validated, run through automated safety/security/policy checks, and reach `pending_review` status with findings and a risk level assigned.

**Independent Test**: Submit a valid mock-app manifest via POST /api/admin/submissions, initiate review, and confirm the submission transitions through draft → pending_checks → pending_review with structured findings recorded.

### Tests for User Story 1

- [x] T013 [P] [US1] Integration test for full new-app submission lifecycle (draft → pending_checks → pending_review) in bridge/tests/integration/submission-lifecycle.test.ts
- [x] T014 [P] [US1] Unit tests for each automated check (schema, permission, origin, content) in bridge/tests/unit/checks.test.ts

### Implementation for User Story 1

- [x] T015 [US1] Implement SubmissionService.createSubmission — accepts manifest + metadata, detects new vs update app, creates App + AppVersion + AppSubmission records, returns submission with status draft in bridge/src/review/SubmissionService.ts
- [x] T016 [P] [US1] Implement ManifestSchemaCheck — validates manifest structure and required fields, returns ReviewFindings in bridge/src/review/checks/ManifestSchemaCheck.ts
- [x] T017 [P] [US1] Implement PermissionPolicyCheck — flags dangerous or K-12 inappropriate permissions, returns ReviewFindings in bridge/src/review/checks/PermissionPolicyCheck.ts
- [x] T018 [P] [US1] Implement OriginAllowlistCheck — validates origins against known-safe patterns, returns ReviewFindings in bridge/src/review/checks/OriginAllowlistCheck.ts
- [x] T019 [P] [US1] Implement ContentPolicyCheck — scans manifest metadata/description for policy violations, returns ReviewFindings in bridge/src/review/checks/ContentPolicyCheck.ts
- [x] T020 [US1] Implement AutomatedCheckPipeline — runs all checks sequentially, records findings, handles check failures with retry support, transitions submission to pending_review in bridge/src/review/AutomatedCheckPipeline.ts
- [x] T021 [US1] Implement RiskAssessor — aggregates findings by severity to assign ReviewRiskLevel to submission in bridge/src/review/RiskAssessor.ts
- [x] T022 [US1] Implement SubmissionService.initiateReview — validates manifest, runs AutomatedCheckPipeline, assigns risk level, transitions draft → pending_checks → pending_review in bridge/src/review/SubmissionService.ts
- [x] T023 [US1] Implement submission admin routes: POST /api/admin/submissions (create), POST /api/admin/submissions/:id/initiate-review, POST /api/admin/submissions/:id/retry-checks, GET /api/admin/submissions/:id (detail with findings) in bridge/src/admin/submissionRoutes.ts
- [x] T024 [US1] Implement GET /api/admin/submissions list endpoint with status and app_id filtering in bridge/src/admin/submissionRoutes.ts

**Checkpoint**: New app submissions flow from creation through automated checks to pending_review. Reviewers can see findings and risk levels. US1 is independently testable via curl.

---

## Phase 4: User Story 2 - Reject a New Unsafe App (Priority: P1)

**Goal**: A reviewer can reject a submission in pending_review. The rejected version is permanently closed, never enters the registry, and remains visible only to internal reviewers for audit.

**Independent Test**: Submit an app, initiate review, reject it via POST /api/admin/submissions/:id/decide, confirm status is rejected and app does NOT appear in GET /api/registry/active.

### Tests for User Story 2

- [x] T025 [P] [US2] Integration test for rejection flow: submit → check → reject → verify not in registry in bridge/tests/integration/submission-lifecycle.test.ts

### Implementation for User Story 2

- [x] T026 [US2] Implement ReviewDecisionService.decide — records ReviewDecision with rationale, findings_considered, and reviewer identity. For reject: transitions submission to rejected (terminal state) in bridge/src/review/ReviewDecisionService.ts
- [x] T027 [US2] Implement POST /api/admin/submissions/:id/decide endpoint (reject path) — validates submission is in pending_review, rationale is non-empty, records decision in bridge/src/admin/submissionRoutes.ts
- [x] T028 [US2] Implement POST /api/admin/submissions/:id/findings endpoint — allows reviewer to add manual findings before deciding in bridge/src/admin/submissionRoutes.ts

**Checkpoint**: Rejected submissions are permanently closed. Rejection path is end-to-end functional.

---

## Phase 5: User Story 3 - Approved App Becomes Usable in Chat (Priority: P1) MVP Complete

**Goal**: A reviewer can approve a submission. Approval creates a RegistryEntry. The approved app appears in the active registry and is discoverable by Chatbox. Session launch pins the chat session to the approved version.

**Independent Test**: Submit → approve → verify app appears in GET /api/registry/active with display metadata and tool schemas. Launch a session via POST /api/sessions/launch and confirm pinned version.

### Tests for User Story 3

- [x] T029 [P] [US3] Integration test for approval + registry projection: approve → verify in /registry/active in bridge/tests/integration/registry-projection.test.ts
- [x] T030 [P] [US3] Integration test for session launch + pinning in bridge/tests/integration/session-pinning.test.ts

### Implementation for User Story 3

- [x] T031 [US3] Extend ReviewDecisionService.decide — for approve: transition to approved, create RegistryEntry with denormalized display metadata and tool schemas in bridge/src/review/ReviewDecisionService.ts
- [x] T032 [US3] Implement GET /api/registry/active and GET /api/registry/active/:appId endpoints — query registry_entries table only, return ActiveRegistryApp[] in bridge/src/admin/registryRoutes.ts
- [x] T033 [US3] Implement POST /api/sessions/launch — records (chatSessionId, appId, pinnedVersionId), returns pinned version info and app snapshot in bridge/src/admin/registryRoutes.ts
- [x] T034 [US3] Implement GET /api/sessions/:appSessionId/status — returns session status with version_update_available flag in bridge/src/admin/registryRoutes.ts
- [x] T035 [US3] Modify AppRegistry.ts to read from registry_entries table on startup and refresh cache on registry mutations in bridge/src/registry/AppRegistry.ts
- [x] T036 [US3] Create BridgeRegistryAdapter — thin REST client that fetches GET /api/registry/active and transforms to Chatbox tool discovery format in chatbox/src/adapters/BridgeRegistryAdapter.ts

**Checkpoint**: Full P1 MVP complete. New apps can be submitted, reviewed, approved/rejected, and approved apps are discoverable in chat with session pinning. This is the minimum deployable product.

---

## Phase 6: User Story 4 & 5 - Version Updates, Diff, and Re-Audit (Priority: P2)

**Goal**: When a reviewer submits an updated version of an already-approved app, the system detects the update, generates a structured diff against the prior approved version, escalates risk level for trust-boundary changes, and presents the diff to the reviewer.

**Independent Test**: Submit v1 → approve → submit v2 with expanded permissions → confirm is_update=true, diff_result shows added permissions, risk level escalated to high.

### Tests for User Story 4 & 5

- [x] T037 [P] [US4] Integration test for update detection and diff generation in bridge/tests/integration/update-diff-review.test.ts
- [x] T038 [P] [US5] Unit test for DiffGenerator with various manifest change scenarios in bridge/tests/unit/DiffGenerator.test.ts
- [x] T039 [P] [US5] Unit test for RiskAssessor with diff-based escalation in bridge/tests/unit/RiskAssessor.test.ts

### Implementation for User Story 4 & 5

- [x] T040 [US4] Implement DiffGenerator — recursive structural JSON diff with path-based risk classification (critical/elevated/standard) per contracts/diff-contract.md in bridge/src/review/DiffGenerator.ts
- [x] T041 [US4] Implement ScopeExpansionCheck — for updates, flags new scopes not present in prior approved version, returns contextualized ReviewFindings in bridge/src/review/checks/ScopeExpansionCheck.ts
- [x] T042 [US4] Extend SubmissionService.createSubmission — when is_update=true, set prior_approved_version_id, run DiffGenerator, store diff_result on AppSubmission in bridge/src/review/SubmissionService.ts
- [x] T043 [US5] Extend RiskAssessor — incorporate diff-derived risk alongside findings-derived risk, take the maximum in bridge/src/review/RiskAssessor.ts
- [x] T044 [US5] Extend GET /api/admin/submissions/:id — include diff_result with structured change list and prior_approved_version manifest in response in bridge/src/admin/submissionRoutes.ts

**Checkpoint**: Update submissions generate diffs, risk levels escalate for trust-boundary changes, and reviewers see what changed.

---

## Phase 7: User Story 6 & 7 - Update Decisions, Rollback & Suspension (Priority: P2)

**Goal**: Rejecting an updated version leaves the prior approved version active. Approving an updated version supersedes the prior version and replaces the active RegistryEntry. Suspension permanently removes an approved version from the registry.

**Independent Test**: (US6) Approve v1 → submit v2 → reject v2 → confirm v1 still in registry. (US7) Approve v1 → submit v2 → approve v2 → confirm v2 in registry, v1 superseded. Suspend v2 → confirm removed from registry.

### Tests for User Story 6 & 7

- [x] T045 [P] [US6] Integration test for update rejection with rollback safety in bridge/tests/integration/update-diff-review.test.ts
- [x] T046 [P] [US7] Integration test for update approval with supersede in bridge/tests/integration/registry-projection.test.ts
- [x] T047 [P] [US6] Integration test for concurrent submission guard (409 when active review exists) in bridge/tests/integration/concurrency.test.ts

### Implementation for User Story 6 & 7

- [x] T048 [US6] Verify rejection of updated version does NOT modify prior approved version's status or RegistryEntry — add explicit rollback safety validation in ReviewDecisionService.decide reject path in bridge/src/review/ReviewDecisionService.ts
- [x] T049 [US7] Extend ReviewDecisionService.decide approve path — when prior approved version exists: atomically update RegistryEntry to new version and transition prior version to superseded in a single DB transaction in bridge/src/review/ReviewDecisionService.ts
- [x] T050 [US7] Implement POST /api/admin/versions/:id/suspend endpoint — transition approved → suspended, delete RegistryEntry, validate rationale is non-empty in bridge/src/admin/submissionRoutes.ts
- [x] T051 [US7] Implement GET /api/admin/apps/:id/history endpoint — return full version history with submissions, findings, and decisions per app in bridge/src/admin/historyRoutes.ts

**Checkpoint**: All P2 stories complete. Update flow, rollback safety, supersede logic, and suspension all functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, seed data, and validation across all stories

- [x] T052 [P] Create development seed script with mock-app, chess, weather, and spotify manifests pre-approved as test fixtures in bridge/src/db/seed.ts
- [ ] T053 [P] Convert bridge/src/registry/localApps.ts to use DB seed data instead of hardcoded in-memory manifests in bridge/src/registry/localApps.ts
- [x] T054 [P] Add session pinning version_update_available notification — when pinned version differs from current active, include flag in session status and extend host:version-update-available event in bridge/src/admin/registryRoutes.ts
- [ ] T055 Verify partial unique index enforcement for concurrent submission guard (one active review per app) with integration test in bridge/tests/integration/concurrency.test.ts
- [ ] T056 Run full quickstart.md validation — create DB, migrate, seed, start bridge, submit/approve/reject apps, verify registry, test update flow per specs/001-app-onboarding-review/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — builds core submission pipeline
- **US2 (Phase 4)**: Depends on Phase 3 — adds rejection to existing pipeline
- **US3 (Phase 5)**: Depends on Phase 4 — adds approval + registry (could start in parallel with US2 on the approve path, but decide endpoint is shared)
- **US4+US5 (Phase 6)**: Depends on Phase 5 — extends submission with diff generation
- **US6+US7 (Phase 7)**: Depends on Phase 6 — exercises update decision paths
- **Polish (Phase 8)**: Depends on Phase 7

### User Story Dependencies

- **US1 (P1)**: Foundation only — no other story dependencies
- **US2 (P1)**: Depends on US1 (needs submission pipeline to reject)
- **US3 (P1)**: Depends on US2 (shares ReviewDecisionService, adds approve path)
- **US4+US5 (P2)**: Depends on US3 (needs approved version to diff against)
- **US6+US7 (P2)**: Depends on US4+US5 (needs update flow to exercise decisions)

### Within Each User Story

- Tests written FIRST, expected to FAIL before implementation
- Repository functions → Service layer → API routes
- Core logic before integration endpoints
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2** (after T005+T006+T007 complete):
- T008, T009, T010, T011 — all repository files, different tables, no dependencies

**Phase 3** (after T015):
- T016, T017, T018, T019 — all individual check files, independent implementations

**Phase 6** (after T040):
- T041 independent of T042+T043

**Phase 8**: T052, T053, T054 all independent files

---

## Parallel Example: Phase 2 Repositories

```
Agent 1: T008 — appRepository.ts (App + AppVersion CRUD)
Agent 2: T009 — submissionRepository.ts (AppSubmission CRUD)
Agent 3: T010 — findingRepository.ts (ReviewFinding + ReviewDecision CRUD)
Agent 4: T011 — registryRepository.ts (RegistryEntry CRUD)
```

## Parallel Example: Phase 3 Automated Checks

```
Agent 1: T016 — ManifestSchemaCheck.ts
Agent 2: T017 — PermissionPolicyCheck.ts
Agent 3: T018 — OriginAllowlistCheck.ts
Agent 4: T019 — ContentPolicyCheck.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 = Phases 1–5)

1. Complete Phase 1: Setup (dependencies, tooling)
2. Complete Phase 2: Foundational (DB, types, repositories)
3. Complete Phase 3: US1 — Submission pipeline works
4. Complete Phase 4: US2 — Rejection works
5. Complete Phase 5: US3 — Approval + registry + Chatbox adapter
6. **STOP and VALIDATE**: Full new-app onboarding flow end-to-end
7. Deploy/demo if ready — this is the minimum viable product

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. Add US1 → test submission pipeline → first checkpoint
3. Add US2 + US3 → test approve/reject + registry → **MVP deployable**
4. Add US4 + US5 → test version diffs → update review checkpoint
5. Add US6 + US7 → test update decisions + rollback → **full feature complete**
6. Polish → hardening, seed data, validation

### Parallel Team Strategy

With multiple developers after Phase 2:

- Developer A: US1 automated checks (T016–T019 in parallel)
- Developer B: US1 services (T015, T020, T021)
- After US1: Dev A takes US2, Dev B takes US3 approval path
- After P1 complete: Both devs tackle P2 stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each phase checkpoint should be validated before proceeding
- Commit after each task or logical group
- All bridge admin endpoints are internal-only (not exposed to Chatbox or apps)
- Chatbox touches are minimal: one adapter file (T036)
- Apps directory is never modified — manifests submitted via admin API
- 7-year retention is a DB-level concern, not application logic for v1
