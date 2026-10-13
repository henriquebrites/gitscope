import { Link, useLocation } from 'react-router-dom'
import type { Repository } from '../../types/github'
import { formatCount, formatDate } from '../../utils/formatters'

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
      <h3 className="text-heading-md break-words text-ink">
        <Link
          to={`/users/${encodeURIComponent(login)}/repos/${encodeURIComponent(name)}`}
          state={{ listSearch: search }}
          className="rounded-sm text-link after:absolute after:inset-0"
        >
          {name}
        </Link>
      </h3>
      {description && <p className="text-body-md break-words text-body">{description}</p>}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        <div className="flex gap-1">
          <dt className="text-mute">Estrelas</dt>
          <dd className="text-ink">{formatCount(stargazers_count)}</dd>
        </div>
        {language && (
          <div className="flex gap-1">
            <dt className="text-mute">Linguagem</dt>
            <dd className="text-ink">{language}</dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt className="text-mute">Atualizado em</dt>
          <dd className="text-ink">{formatDate(updated_at)}</dd>
        </div>
      </dl>
    </li>
  )
}

export default RepositoryItem
