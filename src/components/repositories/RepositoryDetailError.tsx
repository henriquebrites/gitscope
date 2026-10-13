import { Link } from 'react-router-dom'
import type { GitHubError } from '../../services/githubApi'
import { formatTime } from '../../utils/formatters'

interface RepositoryDetailErrorProps {
  error: GitHubError
  login: string
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

function ErrorContent({ error, login, onRetry }: RepositoryDetailErrorProps) {
  switch (error.kind) {
    case 'not-found':
      return (
        <>
          <h1 className="text-heading-lg text-ink">Repositório não encontrado</h1>
          <p className="text-body-lg text-body">
            Este repositório não existe ou não é público. Confira o endereço.
          </p>
          <Link
            to={`/users/${encodeURIComponent(login)}`}
            className="self-start rounded-sm text-body-md break-words text-link underline"
          >
            Voltar ao perfil de {login}
          </Link>
        </>
      )
    case 'network':
      return (
        <>
          <h1 className="text-heading-lg text-ink">Sem conexão</h1>
          <p className="text-body-lg text-body">Não foi possível conectar ao GitHub.</p>
          <RetryButton onRetry={onRetry} />
        </>
      )
    case 'rate-limited':
      return (
        <>
          <h1 className="text-heading-lg text-ink">Limite de consultas atingido</h1>
          <p className="text-body-lg text-body">
            O GitHub limitou temporariamente as consultas feitas a partir desta rede.
          </p>
          <p className="text-body-lg text-body">
            {error.resetAt
              ? `As consultas voltam a ser liberadas às ${formatTime(error.resetAt)}.`
              : 'Tente de novo mais tarde.'}
          </p>
        </>
      )
    case 'unexpected':
      return (
        <>
          <h1 className="text-heading-lg text-ink">Algo deu errado</h1>
          <p className="text-body-lg text-body">
            Não foi possível carregar este repositório agora.
          </p>
          <RetryButton onRetry={onRetry} />
        </>
      )
  }
}

function RepositoryDetailError(props: RepositoryDetailErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas-elevated p-6"
    >
      <ErrorContent {...props} />
    </div>
  )
}

export default RepositoryDetailError
