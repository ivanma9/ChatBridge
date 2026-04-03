import { describe, expect, it } from 'vitest'
import { doesEntryUrlMatchAllowedOrigin } from './originValidation'

describe('doesEntryUrlMatchAllowedOrigin', () => {
  it('returns true for matching origins', () => {
    expect(
      doesEntryUrlMatchAllowedOrigin('https://apps.example.com/weather?mode=full', 'https://apps.example.com')
    ).toBe(true)
  })

  it('returns false for mismatched origins', () => {
    expect(
      doesEntryUrlMatchAllowedOrigin('https://apps.example.com/weather', 'https://bridge.example.com')
    ).toBe(false)
  })
})
