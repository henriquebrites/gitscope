import type { SortKey } from '../types/github'

export const REPOSITORIES_PER_PAGE = 30

export const DEFAULT_SORT: SortKey = 'stars-desc'

const sortKeys: readonly SortKey[] = ['stars-desc', 'stars-asc', 'name-asc', 'updated-desc']

/** `?sort=`: anything other than a known key falls back to `stars-desc`. */
export function parseSort(raw: string | null): SortKey {
  return sortKeys.find((key) => key === raw) ?? DEFAULT_SORT
}

/** Visual pages for `total` items; an empty list still has page 1. */
export function pageCount(total: number, perPage = REPOSITORIES_PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage))
}

/** `?page=`: a whole number from 1 to `totalPages`; anything else is page 1. */
export function parsePage(raw: string | null, totalPages: number): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return page >= 1 && page <= totalPages ? page : 1
}

/** A page number, or a gap standing for two or more hidden pages. */
export type PagerItem = number | 'gap'

/**
 * Numbered pager: the first page, the last, and the current one with a neighbour on each side.
 * A jump that hides one page shows that page; one that hides two or more becomes a gap.
 * 10 pages, on page 5: 1 … 4 5 6 … 10.
 */
export function pagerItems(page: number, totalPages: number): PagerItem[] {
  // Already ascending once the pages outside 1..totalPages are dropped.
  const shown = [...new Set([1, page - 1, page, page + 1, totalPages])].filter((n) => n >= 1 && n <= totalPages)
  return shown.flatMap((n, index): PagerItem[] => {
    const previous = shown[index - 1]
    if (previous === undefined || n - previous === 1) return [n]
    return n - previous === 2 ? [n - 1, n] : ['gap', n]
  })
}
