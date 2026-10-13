import { describe, expect, it } from 'vitest'
import type { SortKey } from '../types/github'
import { pageCount, parsePage, parseSort } from './pagination'

describe('parseSort', () => {
  it.each<[string | null, SortKey]>([
    [null, 'stars-desc'],
    ['xyz', 'stars-desc'],
    ['', 'stars-desc'],
    ['STARS-ASC', 'stars-desc'],
    ['stars-desc', 'stars-desc'],
    ['stars-asc', 'stars-asc'],
    ['name-asc', 'name-asc'],
    ['updated-desc', 'updated-desc'],
  ])('parseSort(%j) is %s', (raw, expected) => {
    expect(parseSort(raw)).toBe(expected)
  })
})

describe('pageCount', () => {
  it.each([
    [237, 8],
    [30, 1],
    [31, 2],
    [0, 1],
  ])('pageCount(%i) is %i', (total, expected) => {
    expect(pageCount(total, 30)).toBe(expected)
  })
})

describe('parsePage', () => {
  it.each<[string | null, number]>([
    [null, 1],
    ['abc', 1],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['', 1],
    ['4', 1],
    ['2', 2],
    ['3', 3],
  ])('parsePage(%j) with 3 pages is %i', (raw, expected) => {
    expect(parsePage(raw, 3)).toBe(expected)
  })
})
