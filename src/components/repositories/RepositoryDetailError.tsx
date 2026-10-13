import { Link } from 'react-router-dom'
import type { GitHubError } from '../../services/githubApi'
import { RequestErrorBox, RequestErrorContent } from '../feedback/RequestError'

interface RepositoryDetailErrorProps {
  error: GitHubError
  login: string
  onRetry: () => void
}

function RepositoryDetailError({ error, login, onRetry }: RepositoryDetailErrorProps) {
  return (
    <RequestErrorBox>
      {error.kind === 'not-found' ? (
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
      ) : (
        <RequestErrorContent
          error={error}
          scale="page"
          unexpectedMessage="Não foi possível carregar este repositório agora."
          onRetry={onRetry}
        />
      )}
    </RequestErrorBox>
  )
}

export default RepositoryDetailError
