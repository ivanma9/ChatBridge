export function doesEntryUrlMatchAllowedOrigin(entryUrl: string, allowedOrigin: string): boolean {
  try {
    return new URL(entryUrl).origin === allowedOrigin
  } catch {
    return false
  }
}
