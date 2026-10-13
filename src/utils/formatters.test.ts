import { describe, expect, it } from 'vitest'
import { formatCount, formatDate, formatTime } from './formatters'

describe('formatters', () => {
  it.each([
    [12345, '12.345'],
    [0, '0'],
    [1000000, '1.000.000'],
  ])('formatCount(%i) is %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected)
  })

  it('formatTime shows the local hour and minute', () => {
    expect(formatTime(new Date(2026, 9, 12, 14, 5))).toBe('14:05')
    expect(formatTime(new Date(2026, 9, 12, 9, 0))).toBe('09:00')
  })

  it('formatDate shows the local date as dd/mm/aaaa', () => {
    // Midday UTC is the same date in every time zone from UTC-11 to UTC+11.
    expect(formatDate('2026-03-05T12:00:00Z')).toBe('05/03/2026')
    expect(formatDate('2011-01-26T12:01:12Z')).toBe('26/01/2011')
  })
})
