const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export class AppProxyTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppProxyTargetError'
  }
}

export function extractProxySubPath(originalUrl: string, appId: string, mountPrefix: string): string {
  return originalUrl.replace(`${mountPrefix}/${appId}`, '') || '/'
}

export function resolveApprovedAppTarget(entryUrl: string, allowedOrigin: string, subPath: string): string {
  if (subPath.startsWith('//') || ABSOLUTE_URL_PATTERN.test(subPath)) {
    throw new AppProxyTargetError('Absolute and scheme-relative proxy targets are not allowed')
  }

  const entryOrigin = new URL(entryUrl).origin
  if (entryOrigin !== allowedOrigin) {
    throw new AppProxyTargetError('App proxy requires entryUrl and allowedOrigin to match exactly')
  }

  const targetUrl = new URL(subPath, entryUrl)
  if (targetUrl.origin !== entryOrigin || targetUrl.origin !== allowedOrigin) {
    throw new AppProxyTargetError('Resolved proxy target origin does not match the approved app origin')
  }

  return targetUrl.toString()
}
