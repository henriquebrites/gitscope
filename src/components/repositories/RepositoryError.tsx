import type { GitHubError } from '../../services/githubApi'
import { formatTime } from '../../utils/formatters'

interface RepositoryErrorProps {
  error: GitHubError
  onRetry: () => void
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="h-10 self-start rounded-sm bg-primary px-4 text-button-md text-on-primary"
    >
      Tentar novamente
    </button>
  )
}

// Same messages as the profile errors (ProfileError), scoped to the repositories section.
function ErrorContent({ error, onRetry }: RepositoryErrorProps) {
  switch (error.kind) {
    case 'network':
      return (
        <>
          <h3 className="text-heading-md text-ink">Sem conexão</h3>
          <p className="text-body-md text-body">Não foi possível conectar ao GitHub.</p>
          <RetryButton onRetry={onRetry} />
        </>
      )
    case 'rate-limited':
      return (
        <>
          <h3 className="text-heading-md text-ink">Limite de consultas atingido</h3>
          <p className="text-body-md text-body">
            O GitHub limitou temporariamente as consultas feitas a partir desta rede.
          </p>
          <p className="text-body-md text-body">
            {error.resetAt
              ? `As consultas voltam a ser liberadas às ${formatTime(error.resetAt)}.`
              : 'Tente de novo mais tarde.'}
          </p>
        </>
      )
    // The profile exists, so a missing list is not a "not found" the user can fix.
    case 'not-found':
    case 'unexpected':
      return (
        <>
          <h3 className="text-heading-md text-ink">Algo deu errado</h3>
          <p className="text-body-md text-body">Não foi possível carregar os repositórios agora.</p>
          <RetryButton onRetry={onRetry} />
        </>
      )
  }
}

function RepositoryError(props: RepositoryErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas-elevated p-6"
    >
      <ErrorContent {...props} />
    </div>
  )
}

export default RepositoryError
