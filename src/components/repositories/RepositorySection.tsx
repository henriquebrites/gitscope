import { useId, useMemo } from 'react'
import type { RepositoriesResult } from '../../hooks/useRepositories'
import type { SortKey } from '../../types/github'
import { pageCount, parsePage, REPOSITORIES_PER_PAGE } from '../../utils/pagination'
import { sortRepositories } from '../../utils/sortRepositories'
import RepositoryError from './RepositoryError'
import RepositoryItem from './RepositoryItem'
import RepositoryPager from './RepositoryPager'
import RepositorySort from './RepositorySort'

interface RepositorySectionProps {
  result: RepositoriesResult
  login: string
  sort: SortKey
  /** Raw `?page=`; validated against the number of pages once the list is known. */
  pageParam: string | null
  onSortChange: (sort: SortKey) => void
  onPageChange: (page: number) => void
  onRetry: () => void
}

function RepositorySection({
  result,
  login,
  sort,
  pageParam,
  onSortChange,
  onPageChange,
  onRetry,
}: RepositorySectionProps) {
  const headingId = useId()
  const repositories = result.status === 'success' ? result.repositories : null
  const sorted = useMemo(
    () => (repositories ? sortRepositories(repositories, sort) : []),
    [repositories, sort],
  )
  const totalPages = pageCount(sorted.length)
  const page = parsePage(pageParam, totalPages)
  const visible = sorted.slice((page - 1) * REPOSITORIES_PER_PAGE, page * REPOSITORIES_PER_PAGE)

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={headingId} className="text-heading-md text-ink">
          Repositórios
        </h2>
        {sorted.length > 0 && <RepositorySort sort={sort} onSortChange={onSortChange} />}
      </div>
      {/* Always mounted, so screen readers announce every page of progress. */}
      <p
        aria-live="polite"
        className={result.status === 'loading' ? 'text-body-md text-body' : 'sr-only text-body-md text-body'}
      >
        {result.status === 'loading' ? `Carregando repositórios… (página ${result.page})` : ''}
      </p>
      {result.status === 'error' && <RepositoryError error={result.error} onRetry={onRetry} />}
      {repositories?.length === 0 && (
        <p className="text-body-md text-mute">Esta conta não tem repositórios públicos.</p>
      )}
      {visible.length > 0 && (
        // Two columns from 640px; grid rows stretch, so cards side by side share one height.
        <ul data-testid="repository-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((repository) => (
            <RepositoryItem key={repository.id} repository={repository} login={login} />
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <RepositoryPager page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </section>
  )
}

export default RepositorySection
