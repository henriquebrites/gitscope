import type { GitHubError } from '../../services/githubApi'
import { RequestErrorBox, RequestErrorContent } from '../feedback/RequestError'

interface RepositoryErrorProps {
  error: GitHubError
  onRetry: () => void
}

function RepositoryError({ error, onRetry }: RepositoryErrorProps) {
  return (
    <RequestErrorBox>
      <RequestErrorContent
        // The profile exists, so a missing list is not a "not found" the user can fix.
        error={error.kind === 'not-found' ? { kind: 'unexpected' } : error}
        scale="section"
        unexpectedMessage="Não foi possível carregar os repositórios agora."
        onRetry={onRetry}
      />
    </RequestErrorBox>
  )
}

export default RepositoryError
