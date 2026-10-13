import type { RepositoryResult } from '../../hooks/useRepository'
import RepositoryDetail from './RepositoryDetail'
import RepositoryDetailError from './RepositoryDetailError'
import RepositoryDetailSkeleton from './RepositoryDetailSkeleton'

interface RepositoryDetailSectionProps {
  result: RepositoryResult
  login: string
  onRetry: () => void
}

function RepositoryDetailSection({ result, login, onRetry }: RepositoryDetailSectionProps) {
  return (
    <section aria-label="Repositório" className="flex flex-col gap-6">
      {/* Always mounted, so screen readers announce the change into loading. */}
      <p aria-live="polite" className="sr-only text-body-md text-body">
        {result.status === 'loading' ? 'Carregando repositório…' : ''}
      </p>
      {result.status === 'loading' && <RepositoryDetailSkeleton />}
      {result.status === 'success' && <RepositoryDetail repository={result.repository} />}
      {result.status === 'error' && (
        <RepositoryDetailError error={result.error} login={login} onRetry={onRetry} />
      )}
    </section>
  )
}

export default RepositoryDetailSection
