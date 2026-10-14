import { Link, useLocation } from 'react-router-dom'
import type { Repository } from '../../types/github'
import { formatCount, formatDate } from '../../utils/formatters'
import LanguageDot from './LanguageDot'

interface RepositoryItemProps {
  repository: Repository
  login: string
}

function RepositoryItem({ repository, login }: RepositoryItemProps) {
  const { name, description, stargazers_count, language, updated_at } = repository
  // The detail's way back returns to this sort and page (read by `listSearchFrom`).
  const { search } = useLocation()

  return (
    // The link's overlay makes the whole card the click target.
    <li className="relative flex flex-col gap-2 rounded-md border border-hairline bg-canvas-elevated p-4 hover:border-mute">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-heading-md break-words text-ink">
          <Link
            to={`/users/${encodeURIComponent(login)}/repos/${encodeURIComponent(name)}`}
            state={{ listSearch: search }}
            className="rounded-sm text-link after:absolute after:inset-0"
          >
            {name}
          </Link>
        </h3>
        <p
          data-testid="repository-stars"
          className="shrink-0 rounded-pill bg-hairline-soft px-2 py-1 font-mono text-body-sm whitespace-nowrap text-ink tabular-nums"
        >
          <span aria-hidden="true">★</span> {formatCount(stargazers_count)}
          <span className="sr-only"> estrelas</span>
        </p>
      </div>
      <p className={`text-body-md break-words ${description ? 'text-body' : 'text-mute'}`}>
        {description ?? 'Sem descrição.'}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-mute">
        {language && <LanguageDot language={language} />}
        <span>Atualizado em {formatDate(updated_at)}</span>
      </div>
    </li>
  )
}

export default RepositoryItem
