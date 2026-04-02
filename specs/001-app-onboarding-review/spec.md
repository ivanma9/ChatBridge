# Feature Specification: App Onboarding, Version Review, and Registry Eligibility

**Feature Branch**: `001-app-onboarding-review`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: Bridge-platform onboarding and approval workflow for third-party apps serving K-12 users. Internal reviewers submit new apps and updated versions, run automated trust checks, manually approve or reject versions, and control whether a version becomes part of the active bridge registry that powers chat discovery and invocation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Onboard a First-Time App (Priority: P1)

An internal reviewer receives a new third-party app that a school district wants to use. The reviewer creates a submission with the app's manifest and metadata. The system validates the manifest structure, runs automated safety, security, and policy checks, and assigns a risk level. The reviewer examines the automated findings, adds their own assessment, and makes an approve or reject decision. If approved, the app version becomes the active entry in the bridge registry and is discoverable and invokable in student and teacher chat sessions.

**Why this priority**: This is the foundational workflow. Without new-app onboarding, no apps enter the registry and the entire system has no value.

**Independent Test**: Can be fully tested by submitting a new app manifest, walking it through automated checks and manual review, approving it, and confirming it appears in the active registry.

**Acceptance Scenarios**:

1. **Given** a reviewer has a valid app manifest, **When** they create a new submission, **Then** the system creates an App record, an AppVersion record, and an AppSubmission record with status `draft`.
2. **Given** a draft submission exists, **When** the reviewer initiates review, **Then** the system validates the manifest structure and metadata, transitions to `pending_checks`, runs automated safety/security/policy checks, records findings, assigns a risk level, and transitions to `pending_review`.
3. **Given** a submission is in `pending_review` with all automated findings visible, **When** the reviewer approves the version, **Then** the system records the ReviewDecision with rationale, sets ApprovalStatus to `approved`, creates a RegistryEntry for the version, and the app becomes discoverable and invokable in chat.

---

### User Story 2 - Reject a New Unsafe App (Priority: P1)

An internal reviewer evaluates a first-time app submission. Automated checks flag critical safety concerns (e.g., the app requests access to student PII without justification, embeds external tracking scripts, or violates K-12 content policies). The reviewer examines the automated findings, confirms the risks, and rejects the submission. The rejected version never enters the active registry and remains visible only to internal reviewers for audit purposes.

**Why this priority**: K-12 safety is the core trust guarantee. The ability to reject and keep unsafe apps out of the registry is as critical as the ability to approve.

**Independent Test**: Can be fully tested by submitting an app with known policy violations, verifying automated checks flag the issues, rejecting it, and confirming the app does not appear in the active registry or in any chat discovery results.

**Acceptance Scenarios**:

1. **Given** a submission is in `pending_review` with critical safety findings, **When** the reviewer rejects the version, **Then** the system records the ReviewDecision with rejection rationale, sets ApprovalStatus to `rejected`, and does NOT create a RegistryEntry.
2. **Given** a rejected submission, **When** a chat user searches for available apps, **Then** the rejected app does not appear in discovery results and cannot be invoked.
3. **Given** a rejected submission, **When** a reviewer views the submission catalog, **Then** the rejected submission and its findings are visible for audit purposes.

---

### User Story 3 - Approved App Becomes Usable in Chat (Priority: P1)

After a reviewer approves a new app version, the approved version is projected into the active bridge registry. Chat users (students and teachers) can now discover the app through the Chatbox tool discovery interface and invoke it within their chat sessions. The Chatbox consumes only the active approved registry and has no visibility into pending, rejected, or draft submissions.
The onboarding and approval workflow operates on submitted app manifests, metadata, and review outcomes; it does not require modifying existing third-party app implementations as part of approval or rejection.

**Why this priority**: The entire purpose of the review workflow is to gate what enters the registry. This story validates the end-to-end value chain from approval to user access.

**Independent Test**: Can be fully tested by approving an app, then querying the active registry from the Chatbox perspective and confirming the app appears and is invokable.

**Acceptance Scenarios**:

1. **Given** a version has been approved and a RegistryEntry exists, **When** the Chatbox queries the active registry for available tools, **Then** the approved app version appears in the results with its display metadata.
2. **Given** no approved version exists for an app, **When** the Chatbox queries the active registry, **Then** the app does not appear regardless of how many draft, pending, or rejected versions exist.

---

### User Story 4 - Submit an Updated Version of an Approved App (Priority: P2)

A reviewer needs to process an updated version of an app that already has an approved version in the registry. The reviewer creates a new submission for the updated version. The system detects that a prior approved version exists, diffs the updated manifest against the previously approved version (comparing permissions, scopes, origins, tools, and UI metadata), and highlights what changed. Automated checks run on the new version, with escalated review depth when risk-sensitive fields have changed (e.g., expanded permissions, new origins, additional data scopes).

**Why this priority**: Apps will regularly release updates. Version-level re-audit is essential to prevent trust drift where an initially safe app gradually expands its access.

**Independent Test**: Can be fully tested by submitting an updated manifest for an already-approved app, verifying the system generates a diff against the prior version, and confirming escalated checks when permissions expand.

**Acceptance Scenarios**:

1. **Given** an app has an approved version in the registry, **When** a reviewer submits a new version, **Then** the system creates a new AppVersion and AppSubmission, detects this is an update (not a first-time submission), and links it to the existing App.
2. **Given** an updated submission is created, **When** the system runs automated checks, **Then** it generates a diff comparing the new version's manifest, permissions, scopes, origins, tools, and UI metadata against the prior approved version.
3. **Given** the diff shows changes to risk-sensitive fields (permissions, scopes, origins), **When** the system assigns a risk level, **Then** the risk level is escalated and the reviewer is alerted to the elevated review depth required.

---

### User Story 5 - Review Changes in an Updated Version (Priority: P2)

A reviewer opens an updated version submission and sees a clear summary of what changed compared to the previously approved version. The diff highlights added, removed, and modified permissions, scopes, origins, tools, and UI fields. Automated findings are contextualized against the changes (e.g., "new permission X was not present in the approved version"). The reviewer can assess whether the changes are justified and safe.

**Why this priority**: Efficient, accurate re-audit depends on the reviewer being able to quickly understand what changed and why it matters.

**Independent Test**: Can be fully tested by comparing a known-changed manifest against its prior approved version and verifying the diff output accurately reflects all changes.

**Acceptance Scenarios**:

1. **Given** an updated submission with a diff generated, **When** the reviewer views the submission details, **Then** they see a structured comparison showing added, removed, and modified fields between the new and previously approved versions.
2. **Given** automated findings for an updated version, **When** the reviewer views findings, **Then** each finding references whether it relates to a new field, a changed field, or an existing field.

---

### User Story 6 - Reject an Updated Version (Old Version Stays Active) (Priority: P2)

A reviewer rejects an updated version because the changes introduce unacceptable risks. The rejected update does not affect the currently active approved version. The previously approved version remains in the active registry, continues to power chat discovery and invocation, and active chat sessions remain pinned to it. The rejected update is recorded in the version review history for audit.

**Why this priority**: Rollback safety is a hard requirement. A failed update must never disrupt existing approved service.

**Independent Test**: Can be fully tested by rejecting an updated version and confirming the prior approved version remains active in the registry and invokable in chat.

**Acceptance Scenarios**:

1. **Given** an app has an approved version (v1) in the registry and an updated version (v2) in `pending_review`, **When** the reviewer rejects v2, **Then** v2's ApprovalStatus becomes `rejected`, v1 remains the active RegistryEntry, and the app continues to be discoverable and invokable in chat via v1.
2. **Given** v2 is rejected, **When** a reviewer views the app's version review history, **Then** both v1 (approved) and v2 (rejected) are visible with their respective findings and decisions.
3. **Given** active chat sessions are using v1, **When** v2 is rejected, **Then** active sessions experience no disruption and remain pinned to v1.

---

### User Story 7 - Approve an Updated Version (Replaces Prior Active Version) (Priority: P2)

A reviewer approves an updated version after confirming the changes are safe and justified. The newly approved version replaces the prior version as the active RegistryEntry. The prior version's status transitions to `superseded`. New chat sessions and tool discovery results now use the updated version. Existing active sessions remain pinned to the prior version but display a notification that a newer version is available.

**Why this priority**: This completes the version lifecycle. Approved updates must cleanly promote into the registry while maintaining an orderly transition.

**Independent Test**: Can be fully tested by approving an updated version, confirming the new version is active in the registry, confirming the prior version is marked superseded, and confirming new chat sessions use the updated version.

**Acceptance Scenarios**:

1. **Given** an app has an approved version (v1) and an updated version (v2) in `pending_review`, **When** the reviewer approves v2, **Then** v2 becomes the active RegistryEntry, v1's ApprovalStatus transitions to `superseded`, and new chat discovery returns v2.
2. **Given** v2 is approved and active, **When** a reviewer views the app's version history, **Then** v1 shows as `superseded` and v2 shows as `approved`, with a complete audit trail for both.

---

### Edge Cases

- What happens when a submission has a malformed or invalid manifest? The system rejects it during validation with specific error details and the submission remains in `draft` without progressing to automated checks.
- What happens when automated checks fail to complete (e.g., external service timeout)? The submission remains in `pending_checks` and the reviewer is notified of the failure. Checks can be retried without creating a new submission.
- What happens when an updated version expands permissions or scopes significantly? The system escalates the risk level and flags the submission for elevated review depth, alerting the reviewer to the trust-boundary changes.
- What happens when an updated version changes origin URLs or UI embed URLs? These are treated as risk-sensitive field changes, triggering escalated review and explicit diff highlighting.
- What happens when a reviewer wants to suspend a previously approved version (e.g., a vulnerability is discovered post-approval)? The reviewer can transition an approved version to `suspended`, which removes it from the active registry immediately. Suspension is permanent for that version — it cannot be reinstated. If no other approved version exists, the app becomes undiscoverable in chat until a new version is submitted and approved.
- What happens when two versions are submitted concurrently for the same app? Only one submission per app can be in an active review state (`pending_checks` or `pending_review`) at a time. A second submission must wait until the first is resolved (approved, rejected, or returned to draft).
- What happens when the only approved version is suspended and no replacement exists? The app has no active RegistryEntry and is not discoverable or invokable in chat until a new version is approved.
- What happens when a reviewer submits a version identical to the prior approved version? The system generates a diff showing no changes, assigns a low risk level, and the reviewer can approve or reject as normal.
- What happens after a version is rejected? The rejected submission is permanently closed and immutable. To retry, a reviewer must create a new AppVersion and AppSubmission for the same App, which goes through the full review cycle from scratch. Rejection is not terminal for the App itself.

## Clarifications

### Session 2026-04-02

- Q: What is the resubmission path after a version is rejected? → A: A new AppVersion and AppSubmission must be created; the rejected submission is permanently closed and retained for audit only. Rejection is not terminal for the app — only for that specific version submission.
- Q: Is there role differentiation between reviewers and administrators? → A: No. V1 has a single "reviewer" role. All internal reviewers can submit, review, approve, reject, and suspend. Role hierarchy is deferred to a future version.
- Q: When a new version is approved and promoted, what happens to active chat sessions on the old version? → A: Sessions stay pinned to their starting version but display a notification that a newer version is available. New sessions use the promoted version.
- Q: Can a suspended version be reinstated to approved? → A: No. Suspension is permanent for that version. To restore service, a new AppVersion must be submitted and reviewed from scratch.
- Q: How long must review audit trails be retained? → A: Up to 7 years, aligned with FERPA education record retention guidance for K-12 compliance.

## Requirements *(mandatory)*

### Functional Requirements

**Submission and Manifest Handling**

- **FR-001**: System MUST allow internal reviewers to create a new app submission by providing an app manifest and metadata.
- **FR-002**: System MUST validate the manifest structure and required metadata fields before progressing a submission beyond `draft` status.
- **FR-003**: System MUST detect whether a submission is for a new app or an updated version of an existing app by matching app identifiers.
- **FR-004**: System MUST reject malformed submissions with specific validation error details and keep them in `draft` status.

**Automated Checks**

- **FR-005**: System MUST run automated safety, security, and policy checks on every submission that passes manifest validation.
- **FR-006**: System MUST record each automated check result as a ReviewFinding associated with the submission.
- **FR-007**: System MUST assign a ReviewRiskLevel to each submission based on the aggregate results of automated checks and the nature of changes (for updates).
- **FR-008**: System MUST allow automated checks to be retried for a submission without creating a new submission if checks fail to complete.

**Version Diffing and Update Detection**

- **FR-009**: For updated versions, the system MUST generate a structured diff comparing the new version's manifest, permissions, scopes, origins, tools, and UI metadata against the most recently approved version.
- **FR-010**: System MUST escalate the ReviewRiskLevel when risk-sensitive fields change between versions (permissions, scopes, origins, data access, external URLs).
- **FR-011**: System MUST present the diff and change context to reviewers alongside automated findings.

**Manual Review and Decision**

- **FR-012**: System MUST require a manual reviewer decision (approve or reject) before any version can become registry-eligible. Automated checks alone are insufficient for approval.
- **FR-013**: System MUST record every ReviewDecision with the reviewer's identity, decision rationale, timestamp, and associated findings.
- **FR-014**: System MUST support the following ApprovalStatus values: `draft`, `pending_checks`, `pending_review`, `approved`, `rejected`, `suspended`, `superseded`.
- **FR-015**: System MUST enforce valid status transitions: `draft` -> `pending_checks` -> `pending_review` -> `approved` or `rejected`. Additionally: `approved` -> `suspended` or `superseded`. Rejected and suspended submissions are permanently closed terminal states and cannot transition to any other status.
- **FR-015a**: After a version is rejected, the system MUST allow creation of a new AppVersion and AppSubmission for the same App. The rejected submission remains closed and immutable for audit purposes.

**Registry and Discovery**

- **FR-016**: System MUST create a RegistryEntry for a version only when it reaches `approved` status.
- **FR-017**: System MUST ensure that only one version per app is active in the registry at any time (the most recently approved, non-suspended version).
- **FR-018**: System MUST NOT include versions with status `draft`, `pending_checks`, `pending_review`, `rejected`, `suspended`, or `superseded` in the active registry used for chat discovery and invocation.
- **FR-019**: When a new version is approved for an app that already has an active registry entry, the system MUST transition the prior version to `superseded` and replace the active RegistryEntry with the new version.
- **FR-020**: System MUST allow a reviewer to suspend an approved version, immediately removing it from the active registry.

**Rollback Safety**

- **FR-021**: Rejecting an updated version MUST NOT affect the currently active approved version in the registry.
- **FR-022**: A pending or in-review updated version MUST NOT remove or replace the last approved version from the active registry.
- **FR-023**: Active chat sessions MUST remain pinned to the version that was active when the session started, unaffected by version transitions. When a newer version is promoted, pinned sessions MUST display a notification informing the user that a newer version is available. New sessions MUST use the currently active registry version.

**Concurrency and Integrity**

- **FR-024**: System MUST allow only one submission per app to be in an active review state (`pending_checks` or `pending_review`) at a time.
- **FR-025**: System MUST maintain a complete version review history for each app, including all submissions, findings, and decisions regardless of outcome.

**Access and Visibility**

- **FR-026**: Rejected and draft submissions MUST be visible only to authenticated internal reviewers, never to chat users or external consumers.
- **FR-027**: The Chatbox MUST consume only the active approved registry and MUST NOT have access to the submission catalog, review history, or non-approved version data.
- **FR-028**: V1 uses a single "reviewer" role. All authenticated internal reviewers have full permissions: submit, review, approve, reject, and suspend. Role-based permission tiers are deferred to a future version.
- **FR-029**: The onboarding, review, approval, and registry workflow MUST operate without requiring direct modification of existing third-party app implementations, except where a separate app owner chooses to submit new manifest/build metadata for review.

### Key Entities

- **App**: Represents a third-party application as a logical unit. Has a unique identifier, display name, vendor information, and category. Serves as the parent for all versions. One App can have many AppVersions over time.
- **AppVersion**: A specific version of an App, defined by its manifest content. Contains the version identifier, manifest data (permissions, scopes, origins, tools, UI metadata), and a reference to its parent App. Each version is an independent review unit.
- **AppSubmission**: A review request for a specific AppVersion. Tracks the review lifecycle of that version through status transitions. Contains submission timestamp, submitting reviewer, current ApprovalStatus, and assigned ReviewRiskLevel. One AppVersion has exactly one AppSubmission.
- **ReviewFinding**: An individual finding produced by an automated check or noted by a manual reviewer during the review of a submission. Contains finding type (safety, security, policy, compliance), severity, description, and whether it relates to a new, changed, or existing field (for updates).
- **ReviewDecision**: The final approve or reject decision for a submission. Contains the deciding reviewer's identity, decision (approve/reject), rationale text, timestamp, and references to the findings considered. Each AppSubmission has at most one final ReviewDecision.
- **RegistryEntry**: A record in the active bridge registry representing an approved, non-suspended app version that is discoverable and invokable in chat. Contains a reference to the approved AppVersion, activation timestamp, and display metadata for chat discovery. At most one RegistryEntry exists per App at any time.
- **ApprovalStatus**: The lifecycle state of an AppSubmission. Valid values: `draft`, `pending_checks`, `pending_review`, `approved`, `rejected`, `suspended`, `superseded`.
- **ReviewRiskLevel**: The assessed risk level of a submission based on automated checks and change analysis. Informs the required depth of manual review. Values: `low`, `medium`, `high`, `critical`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of app versions entering the active registry have passed both automated checks and manual reviewer approval. No version reaches registry-eligible status through automated checks alone.
- **SC-002**: Reviewers can complete a full new-app review (from submission to decision) within 30 minutes for low-risk apps and within 2 hours for high-risk apps, excluding wait time for external information.
- **SC-003**: 100% of rejected versions are absent from the active registry and unreachable through chat discovery or invocation at all times.
- **SC-004**: When an updated version is rejected, the previously approved version remains active in the registry with zero downtime or disruption to active chat sessions.
- **SC-005**: For updated version reviews, the system surfaces a complete and accurate diff of all changed fields within 10 seconds of the reviewer opening the submission, enabling faster re-audit compared to reviewing the full manifest from scratch.
- **SC-006**: 100% of review decisions have recorded rationale and associated findings, providing a complete audit trail that can be reviewed by compliance auditors.
- **SC-007**: Risk-sensitive field changes (permissions, scopes, origins) are detected and flagged with an escalated risk level in 100% of updated version submissions where such changes occur.
- **SC-008**: The active registry accurately reflects exactly one approved, non-suspended version per app at all times. No app has zero or multiple active registry entries unless it has been suspended with no replacement.
- **SC-009**: All review audit trail data (submissions, findings, decisions, rationale) is retained for up to 7 years, meeting FERPA-aligned retention requirements for K-12 compliance.

## Assumptions

- V1 is internal-first: only internal reviewers interact with the submission and review workflow. External developer self-service portals are out of scope.
- V1 uses a single "reviewer" role with full permissions (submit, review, approve, reject, suspend). Role-based permission tiers (e.g., reviewer vs admin) are deferred to a future version.
- Approval is per-version, not a blanket trust grant for the app. Every new version requires its own review cycle before becoming registry-eligible.
- Review is mixed automated + manual: automated checks run first to generate findings and risk levels, but manual reviewer approval is always required for registry promotion.
- New app submissions default to full review. Updated versions default to risk-based re-audit, escalating to full review when trust-boundary fields (permissions, scopes, origins) change.
- The last approved version remains active in the registry until a newer version is explicitly approved and promoted. Pending or rejected updates never displace the active version.
- Rejected versions are retained in the submission catalog for audit purposes but are never exposed to chat users or the Chatbox interface.
- The bridge owns the entire onboarding, review, version governance, and registry projection lifecycle. The Chatbox is a consumer of the active approved registry only.
- Existing third-party app implementations are treated as external consumers of the bridge contract. This feature governs whether submitted versions become eligible for registry inclusion; it does not redefine or absorb the apps themselves into bridge-owned logic.
- Automated safety/security/policy checks are defined and maintained as a configurable ruleset by the bridge team. The specific check implementations are outside the scope of this spec but must produce structured ReviewFindings.
- Standard K-12 safety and privacy compliance requirements (COPPA, FERPA alignment) inform the policy checks, though specific regulatory mapping is handled at the check-definition level.
- Review audit trail data (submissions, findings, decisions) must be retained for up to 7 years, aligned with FERPA education record retention guidance.
- App manifests follow a defined schema managed by the bridge platform. Manifest schema definition is a prerequisite dependency but not part of this feature's scope.
