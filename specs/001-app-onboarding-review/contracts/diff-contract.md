# Contract: Version Diff & Risk Assessment

**Owner**: `bridge/` (internal to review workflow)  
**Consumers**: Reviewer UI, ReviewFinding generation

## Diff Result Structure

Generated when an updated version submission is compared against the prior approved version.

```typescript
interface DiffResult {
  prior_version_id: string
  new_version_id: string
  generated_at: string                    // ISO 8601
  overall_risk_level: ReviewRiskLevel     // aggregated from individual changes
  summary: {
    total_changes: number
    additions: number
    removals: number
    modifications: number
    risk_sensitive_changes: number
  }
  changes: DiffChange[]
}

interface DiffChange {
  path: string                            // dot-notation manifest path (e.g., "permissions.camera")
  kind: 'added' | 'removed' | 'modified'
  old_value: unknown | null               // null for additions
  new_value: unknown | null               // null for removals
  risk_category: 'critical' | 'elevated' | 'standard'
  risk_reason: string                     // human-readable explanation
}
```

## Risk Classification Map

| Manifest path pattern | Risk category | Escalation |
|-----------------------|--------------|------------|
| `permissions.*` (added) | critical | → high/critical risk level |
| `permissions.*` (removed) | standard | no escalation (reduced access) |
| `scopes.*` (added) | critical | → high/critical risk level |
| `scopes.*` (removed) | standard | no escalation |
| `origins.*` (changed/added) | critical | → high/critical risk level |
| `tools.*` (added) | elevated | → medium/high risk level |
| `tools.*` (removed) | elevated | → medium risk level |
| `tools.*.inputSchema` (modified) | elevated | → medium risk level |
| `entryUrl` (changed) | elevated | → medium/high risk level |
| `name`, `description` | standard | → low risk level |
| `version` | standard | → low risk level |
| All other fields | standard | → low risk level |

## Aggregation Rules

1. If ANY change is `critical` → overall risk_level = `high` (or `critical` if 3+ critical changes)
2. If ANY change is `elevated` but none `critical` → overall risk_level = `medium`
3. If all changes are `standard` → overall risk_level = `low`
4. For new apps (no prior version): risk_level is determined solely by automated check findings, not diff

## Integration with Automated Checks

The diff result is stored on `AppSubmission.diff_result` and passed to automated checks as context. Checks can reference the diff to produce findings like:

```
"Finding: New permission 'camera' was not present in the approved version v1.0.0. 
 This is a trust-boundary expansion requiring elevated review."
```
