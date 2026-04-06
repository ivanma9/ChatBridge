import { describe, expect, it } from 'vitest'
import { AppProxyTargetError, resolveApprovedAppTarget } from '../../src/admin/appProxyTarget.js'

describe('resolveApprovedAppTarget', () => {
  it('allows subpaths that stay on the approved origin', () => {
    expect(
      resolveApprovedAppTarget('https://apps.example.com/weather', 'https://apps.example.com', '/assets/main.js')
    ).toBe('https://apps.example.com/assets/main.js')
  })

  it('rejects scheme-relative escape attempts', () => {
    expect(() =>
      resolveApprovedAppTarget('https://apps.example.com/weather', 'https://apps.example.com', '//evil.example/app.js')
    ).toThrow(AppProxyTargetError)
  })

  it('rejects absolute URL escape attempts', () => {
    expect(() =>
      resolveApprovedAppTarget('https://apps.example.com/weather', 'https://apps.example.com', 'https://evil.example')
    ).toThrow(AppProxyTargetError)
  })
})
