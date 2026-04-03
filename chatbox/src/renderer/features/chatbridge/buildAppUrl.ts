export function buildAppUrl(entryUrl: string, toolInput?: Record<string, unknown>): string {
  const url = new URL(entryUrl)

  if (toolInput) {
    for (const [key, value] of Object.entries(toolInput)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}
