import { Link } from 'react-router-dom'
import type { GitHubError } from '../../services/githubApi'
import { RequestErrorBox, RequestErrorContent } from '../feedback/RequestError'

interface ProfileErrorProps {
  error: GitHubError
  login: string
  onRetry: () => void
}

function ProfileError({ error, login, onRetry }: ProfileErrorProps) {
  return (
    <RequestErrorBox>
      {error.kind === 'not-found' ? (
        <>
          <h1 className="text-heading-lg text-ink">Conta não encontrada</h1>
          <p className="text-body-lg break-words text-body">
            Nenhuma conta do GitHub usa o login “{login}”. Confira a grafia e busque de novo.
          </p>
          <Link to="/" className="self-start rounded-sm text-body-md text-link underline">
            Voltar ao início
          </Link>
        </>
      ) : (
        <RequestErrorContent
          error={error}
          scale="page"
          unexpectedMessage="Não foi possível carregar este perfil agora."
          onRetry={onRetry}
        />
      )}
    </RequestErrorBox>
  )
}

export default ProfileError
