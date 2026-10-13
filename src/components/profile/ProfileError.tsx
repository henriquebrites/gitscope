import { Link } from 'react-router-dom'
import type { GitHubError } from '../../services/githubApi'
import { formatTime } from '../../utils/formatters'

interface ProfileErrorProps {
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

function ErrorContent({ error, login, onRetry }: ProfileErrorProps) {
  switch (error.kind) {
    case 'not-found':
      return (
        <>
          <h1 className="text-heading-lg text-ink">Conta não encontrada</h1>
          <p className="text-body-lg break-words text-body">
            Nenhuma conta do GitHub usa o login “{login}”. Confira a grafia e busque de novo.
          </p>
          <Link to="/" className="self-start rounded-sm text-body-md text-link underline">
            Voltar ao início
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
            Não foi possível carregar este perfil agora.
          </p>
          <RetryButton onRetry={onRetry} />
        </>
      )
  }
}

function ProfileError(props: ProfileErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas-elevated p-6"
    >
      <ErrorContent {...props} />
    </div>
  )
}

export default ProfileError
