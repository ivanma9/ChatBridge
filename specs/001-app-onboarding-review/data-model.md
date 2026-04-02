# Data Model: App Onboarding, Version Review, and Registry Eligibility

**Branch**: `001-app-onboarding-review` | **Date**: 2026-04-02

## Entity Relationship Overview

```
App (1) ──< (N) AppVersion (1) ──── (1) AppSubmission (1) ──< (N) ReviewFinding
                                                          (1) ──── (0..1) ReviewDecision

App (1) ──── (0..1) RegistryEntry ──── (1) AppVersion
```

## Entities

### App

The logical identity of a third-party application. Parent of all versions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique app identifier |
| external_id | VARCHAR(255) | UNIQUE, NOT NULL | Vendor-assigned or manifest-declared app identifier |
| display_name | VARCHAR(255) | NOT NULL | Human-readable app name |
| vendor_name | VARCHAR(255) | NOT NULL | Name of the app vendor/publisher |
| category | VARCHAR(100) | NULL | App category (e.g., "education", "productivity") |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the app was first registered |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Indexes**: `UNIQUE(external_id)`

---

### AppVersion

A specific version of an app, defined by its manifest content. Each version is an independent review unit.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique version identifier |
| app_id | UUID | FK → App(id), NOT NULL | Parent app |
| version_identifier | VARCHAR(100) | NOT NULL | Version string (e.g., "1.0.0", "2.1.3") |
| manifest | JSONB | NOT NULL | Full app manifest (permissions, scopes, origins, tools, UI metadata, entry URL) |
| manifest_hash | VARCHAR(64) | NOT NULL | SHA-256 hash of canonicalized manifest for quick comparison |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When this version was submitted |
| created_by | VARCHAR(255) | NOT NULL | Reviewer who created this version record |

**Indexes**: `UNIQUE(app_id, version_identifier)`, `INDEX(app_id, created_at DESC)`

**Validation rules**:
- `manifest` must conform to the ChatBridgeAppManifest schema from app-sdk
- `version_identifier` must be non-empty

---

### AppSubmission

The review lifecycle tracker for a specific AppVersion. One-to-one with AppVersion.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique submission identifier |
| version_id | UUID | FK → AppVersion(id), UNIQUE, NOT NULL | The version under review |
| app_id | UUID | FK → App(id), NOT NULL | Denormalized for query efficiency |
| status | approval_status | NOT NULL, DEFAULT 'draft' | Current lifecycle state |
| risk_level | review_risk_level | NULL | Assigned after automated checks |
| is_update | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether this is an update to an existing approved app |
| prior_approved_version_id | UUID | FK → AppVersion(id), NULL | The version this update is compared against |
| diff_result | JSONB | NULL | Structured diff against prior approved version |
| submitted_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the submission was created |
| submitted_by | VARCHAR(255) | NOT NULL | Reviewer who created the submission |
| checks_started_at | TIMESTAMPTZ | NULL | When automated checks began |
| checks_completed_at | TIMESTAMPTZ | NULL | When automated checks finished |
| review_completed_at | TIMESTAMPTZ | NULL | When manual review decision was made |

**Indexes**: `UNIQUE(version_id)`, `INDEX(app_id, status)`, `INDEX(status) WHERE status IN ('pending_checks', 'pending_review')`

**Constraint**: At most one submission per app can have `status IN ('pending_checks', 'pending_review')` at any time. Enforced via partial unique index: `UNIQUE(app_id) WHERE status IN ('pending_checks', 'pending_review')`.

---

### ReviewFinding

An individual finding from automated checks or manual reviewer notes.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique finding identifier |
| submission_id | UUID | FK → AppSubmission(id), NOT NULL | Parent submission |
| source | VARCHAR(50) | NOT NULL | 'automated' or 'manual' |
| check_name | VARCHAR(100) | NOT NULL | Which check produced this finding |
| finding_type | VARCHAR(50) | NOT NULL | 'safety', 'security', 'policy', 'compliance' |
| severity | VARCHAR(20) | NOT NULL | 'info', 'low', 'medium', 'high', 'critical' |
| title | VARCHAR(255) | NOT NULL | Short finding title |
| description | TEXT | NOT NULL | Detailed finding description |
| change_context | VARCHAR(20) | NULL | 'new_field', 'changed_field', 'existing_field' (for updates) |
| affected_path | VARCHAR(500) | NULL | Manifest path that triggered the finding (e.g., "permissions.camera") |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the finding was recorded |
| created_by | VARCHAR(255) | NOT NULL | 'system' for automated, reviewer identity for manual |

**Indexes**: `INDEX(submission_id)`, `INDEX(submission_id, severity)`

---

### ReviewDecision

The final approve/reject decision for a submission. At most one per submission.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique decision identifier |
| submission_id | UUID | FK → AppSubmission(id), UNIQUE, NOT NULL | The submission being decided |
| decision | VARCHAR(20) | NOT NULL, CHECK IN ('approved', 'rejected') | The decision |
| rationale | TEXT | NOT NULL | Reviewer's written rationale |
| reviewer_id | VARCHAR(255) | NOT NULL | Identity of the deciding reviewer |
| findings_considered | UUID[] | NOT NULL | Array of ReviewFinding IDs that informed the decision |
| decided_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the decision was made |

**Indexes**: `UNIQUE(submission_id)`

---

### RegistryEntry

The active bridge registry — only approved, non-suspended versions. At most one entry per app.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| app_id | UUID | PK, FK → App(id) | One active entry per app |
| version_id | UUID | FK → AppVersion(id), NOT NULL | The currently active approved version |
| display_name | VARCHAR(255) | NOT NULL | App display name for chat discovery |
| display_description | TEXT | NULL | App description for chat discovery |
| display_category | VARCHAR(100) | NULL | App category for chat discovery |
| tool_schemas | JSONB | NOT NULL | Tool manifest array for tool discovery |
| entry_url | VARCHAR(2048) | NOT NULL | URL to load the app iframe |
| allowed_origin | VARCHAR(2048) | NOT NULL | Allowed postMessage origin for this app |
| activated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When this version became active |

**Indexes**: PK on `app_id` ensures one entry per app. `INDEX(display_category)` for filtered discovery.

**Projection rules**:
- INSERT on first-time app approval
- UPDATE (version_id, display fields, activated_at) when a new version is approved for an existing app
- DELETE when an approved version is suspended with no replacement

---

## Enum Types

### approval_status

PostgreSQL enum type with values:
- `draft` — initial state, manifest not yet validated
- `pending_checks` — manifest validated, automated checks running
- `pending_review` — automated checks complete, awaiting manual decision
- `approved` — reviewer approved, registry-eligible
- `rejected` — reviewer rejected, permanently closed
- `suspended` — post-approval removal, permanently closed
- `superseded` — replaced by a newer approved version, permanently closed

**Valid transitions**:
```
draft → pending_checks → pending_review → approved
                                        → rejected
approved → suspended
approved → superseded
```
No other transitions are valid. `rejected`, `suspended`, and `superseded` are terminal states.

### review_risk_level

PostgreSQL enum type with values:
- `low` — no risk-sensitive changes detected
- `medium` — minor changes to non-critical fields or tool additions
- `high` — changes to permissions, scopes, or origins
- `critical` — major permission expansion, new external origins, or multiple risk-sensitive changes

**Risk classification rules** (for updates):
| Changed field | Base risk escalation |
|--------------|---------------------|
| permissions (added) | high |
| scopes (added) | high |
| origins (changed) | high |
| tools (added/removed) | medium |
| entryUrl (changed) | medium |
| UI metadata (changed) | low |
| name/description (changed) | low |

For new apps (no prior version), risk level is determined solely by automated check findings severity.

## Retention

All tables except `registry_entries` have a 7-year retention policy. Data older than 7 years may be archived or purged per FERPA-aligned retention guidance. `registry_entries` is a live projection with no retention constraint (rows are created/updated/deleted as versions are approved/suspended).
