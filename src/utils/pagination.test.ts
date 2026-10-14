import { describe, expect, it } from 'vitest'
import type { SortKey } from '../types/github'
import { pageCount, pagerItems, parsePage, parseSort, type PagerItem } from './pagination'

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

describe('pagerItems', () => {
  it.each<[number, number, PagerItem[]]>([
    // The examples of the task, for 10 pages.
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [1, 10, [1, 2, 'gap', 10]],
    [3, 10, [1, 2, 3, 4, 'gap', 10]],
    // A jump that hides one page shows its number instead of a gap.
    [4, 10, [1, 2, 3, 4, 5, 'gap', 10]],
    [8, 10, [1, 'gap', 7, 8, 9, 10]],
    [10, 10, [1, 'gap', 9, 10]],
    [6, 7, [1, 'gap', 5, 6, 7]],
    // Few pages: every number, no gap.
    [1, 2, [1, 2]],
    [2, 2, [1, 2]],
    [2, 3, [1, 2, 3]],
    [3, 5, [1, 2, 3, 4, 5]],
    [1, 1, [1]],
  ])('pagerItems: page %i of %i', (page, total, expected) => {
    expect(pagerItems(page, total)).toEqual(expected)
  })
})
