import { describe, expect, it } from 'vitest'
import { formatCount, formatTime } from './formatters'

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
})
