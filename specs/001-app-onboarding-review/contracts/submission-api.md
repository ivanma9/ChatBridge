# Contract: Submission & Review API

**Owner**: `bridge/`  
**Consumers**: Internal reviewer UI (bridge-hosted admin surface)

These endpoints are bridge-internal and not exposed to Chatbox or apps.

## Endpoints

### POST /api/admin/submissions

Create a new app submission (first-time or update).

**Request**:
```typescript
{
  manifest: ChatBridgeAppManifest  // from app-sdk contracts
  metadata?: {
    vendor_name: string
    category?: string
    notes?: string
  }
}
```

**Response (201)**:
```typescript
{
  submission_id: string      // UUID
  app_id: string             // UUID (created or matched)
  version_id: string         // UUID
  status: 'draft'
  is_update: boolean
  prior_approved_version_id: string | null
}
```

**Errors**:
- `400` — invalid manifest structure
- `409` — an active review already exists for this app (pending_checks or pending_review)

---

### POST /api/admin/submissions/:id/initiate-review

Validate manifest and start automated checks. Transitions draft → pending_checks → pending_review.

**Request**: Empty body (the submission ID is in the path).

**Response (200)**:
```typescript
{
  submission_id: string
  status: 'pending_checks'
  message: 'Automated checks initiated'
}
```

**Errors**:
- `400` — submission not in `draft` status
- `404` — submission not found
- `422` — manifest validation failed (returns validation errors)

---

### POST /api/admin/submissions/:id/retry-checks

Retry automated checks for a submission stuck in pending_checks.

**Response (200)**:
```typescript
{
  submission_id: string
  status: 'pending_checks'
  message: 'Automated checks retried'
}
```

**Errors**:
- `400` — submission not in `pending_checks` status

---

### GET /api/admin/submissions/:id

Get full submission details including findings, diff, and decision.

**Response (200)**:
```typescript
{
  submission: {
    id: string
    version_id: string
    app_id: string
    status: ApprovalStatus
    risk_level: ReviewRiskLevel | null
    is_update: boolean
    submitted_at: string
    submitted_by: string
  }
  app: {
    id: string
    external_id: string
    display_name: string
    vendor_name: string
  }
  version: {
    id: string
    version_identifier: string
    manifest: ChatBridgeAppManifest
  }
  prior_approved_version?: {
    id: string
    version_identifier: string
    manifest: ChatBridgeAppManifest
  }
  diff?: DiffResult              // structured diff (for updates)
  findings: ReviewFinding[]
  decision?: ReviewDecision
}
```

---

### GET /api/admin/submissions

List submissions with filtering.

**Query params**:
- `app_id` — filter by app
- `status` — filter by status (comma-separated)
- `limit` — max results (default 50)
- `offset` — pagination offset

**Response (200)**:
```typescript
{
  submissions: SubmissionSummary[]
  total: number
}
```

---

### POST /api/admin/submissions/:id/findings

Add a manual reviewer finding.

**Request**:
```typescript
{
  finding_type: 'safety' | 'security' | 'policy' | 'compliance'
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  affected_path?: string
}
```

**Response (201)**:
```typescript
{
  finding_id: string
  // ... full finding record
}
```

**Errors**:
- `400` — submission not in `pending_review` status

---

### POST /api/admin/submissions/:id/decide

Record the final approve/reject decision. Triggers registry projection on approval.

**Request**:
```typescript
{
  decision: 'approved' | 'rejected'
  rationale: string
  findings_considered: string[]   // finding IDs
}
```

**Response (200)**:
```typescript
{
  submission_id: string
  status: 'approved' | 'rejected'
  registry_entry_created: boolean     // true if newly added to registry
  registry_entry_updated: boolean     // true if replaced prior version
  prior_version_superseded: boolean   // true if prior version was marked superseded
}
```

**Errors**:
- `400` — submission not in `pending_review` status
- `400` — rationale is empty
- `400` — findings_considered is empty

---

### POST /api/admin/versions/:id/suspend

Suspend a currently approved version. Removes from active registry.

**Request**:
```typescript
{
  rationale: string
}
```

**Response (200)**:
```typescript
{
  version_id: string
  status: 'suspended'
  registry_entry_removed: boolean
}
```

**Errors**:
- `400` — version not in `approved` status
- `400` — rationale is empty

---

### GET /api/admin/apps/:id/history

Get full version and review history for an app.

**Response (200)**:
```typescript
{
  app: App
  versions: Array<{
    version: AppVersion
    submission: AppSubmission
    findings: ReviewFinding[]
    decision?: ReviewDecision
  }>
}
```
