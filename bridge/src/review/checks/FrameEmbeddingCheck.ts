import type { ChatBridgeAppManifest } from '../../../../packages/app-sdk/src/contracts.js'
import type { CheckFinding } from './ManifestSchemaCheck.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function analyzeHeaders(headers: Headers): CheckFinding[] {
  const findings: CheckFinding[] = []
  const base = {
    source: 'automated' as const,
    check_name: 'frame_embedding',
    finding_type: 'security' as const,
    change_context: null,
    created_by: 'system' as const,
  }

  const xFrameOptions = headers.get('x-frame-options')?.toLowerCase()
  if (xFrameOptions === 'deny' || xFrameOptions === 'sameorigin') {
    findings.push({
      ...base,
      severity: 'high',
      title: `Blocking X-Frame-Options header: ${xFrameOptions}`,
      description: 'The app origin sends an X-Frame-Options header that prevents cross-origin embedding.',
      affected_path: 'entryUrl',
    })
  }

  const csp = headers.get('content-security-policy')?.toLowerCase() || ''
  const frameAncestors = csp.match(/frame-ancestors\s+([^;]+)/)?.[1]?.trim()
  if (frameAncestors && (frameAncestors.includes("'none'") || frameAncestors === "'self'")) {
    findings.push({
      ...base,
      severity: 'high',
      title: `Blocking frame-ancestors directive: ${frameAncestors}`,
      description: 'The app origin sends a frame-ancestors directive that does not allow ChatBridge to embed it.',
      affected_path: 'entryUrl',
    })
  }

  return findings
}

export async function runFrameEmbeddingCheck(manifest: ChatBridgeAppManifest): Promise<CheckFinding[]> {
  if (!manifest.entryUrl) {
    return []
  }

  let entryUrl: URL
  try {
    entryUrl = new URL(manifest.entryUrl)
  } catch {
    return []
  }

  if (LOCAL_HOSTS.has(entryUrl.hostname)) {
    return []
  }

  try {
    const response = await fetch(manifest.entryUrl, {
      method: 'HEAD',
      redirect: 'manual',
    })

    return analyzeHeaders(response.headers)
  } catch {
    return []
  }
}
