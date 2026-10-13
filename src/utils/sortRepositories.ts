import type { Repository, SortKey } from '../types/github'

// `api` and `Api` (or `ação` and `acao`) tie; the stable sort then keeps their arrival order.
const byName = new Intl.Collator('pt-BR', { sensitivity: 'base' })

type Compare = (a: Repository, b: Repository) => number

const nameAsc: Compare = (a, b) => byName.compare(a.name, b.name)

const compareBy: Record<SortKey, Compare> = {
  'stars-desc': (a, b) => b.stargazers_count - a.stargazers_count || nameAsc(a, b),
  'stars-asc': (a, b) => a.stargazers_count - b.stargazers_count || nameAsc(a, b),
  'name-asc': nameAsc,
  'updated-desc': (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || nameAsc(a, b),
}

/** The project's only ordering rule (PRD §15): a sorted copy, the input is left untouched. */
export function sortRepositories(repositories: readonly Repository[], sort: SortKey): Repository[] {
  return repositories.toSorted(compareBy[sort])
}
