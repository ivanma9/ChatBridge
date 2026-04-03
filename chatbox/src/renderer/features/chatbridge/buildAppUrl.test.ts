import { describe, expect, it } from 'vitest'
import { buildAppUrl } from './buildAppUrl'

describe('buildAppUrl', () => {
  it('uses the direct app entry url without adding proxy parameters', () => {
    const url = buildAppUrl('https://spotify.example.com/embed')

    expect(url).toBe('https://spotify.example.com/embed')
    expect(new URL(url).searchParams.has('bridge_url')).toBe(false)
  })

  it('preserves the direct origin while appending tool input parameters', () => {
    const url = buildAppUrl('https://weather.example.com', {
      location: 'Chicago',
      units: 'metric',
    })

    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://weather.example.com')
    expect(parsed.searchParams.get('location')).toBe('Chicago')
    expect(parsed.searchParams.get('units')).toBe('metric')
    expect(parsed.searchParams.has('bridge_url')).toBe(false)
  })
})
