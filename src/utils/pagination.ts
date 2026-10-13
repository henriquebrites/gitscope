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
