import type { Repository } from '../../types/github'
import { formatCount } from '../../utils/formatters'

function RepositoryDetail({ repository }: { repository: Repository }) {
  const { name, description, stargazers_count, language, html_url } = repository

  return (
    <article className="flex flex-col gap-4 rounded-md border border-hairline bg-canvas-elevated p-6">
      <h1 className="text-heading-lg break-words text-ink">{name}</h1>
      <p className={`text-body-lg break-words ${description ? 'text-body' : 'text-mute'}`}>
        {description ?? 'Sem descrição.'}
      </p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-body-md">
        <div className="flex gap-1">
          <dt className="text-mute">Estrelas</dt>
          <dd className="text-label-sm text-ink">{formatCount(stargazers_count)}</dd>
        </div>
        {language && (
          <div className="flex gap-1">
            <dt className="text-mute">Linguagem</dt>
            <dd className="text-label-sm text-ink">{language}</dd>
          </div>
        )}
      </dl>
      <a
        href={html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start rounded-sm text-body-md text-link underline"
      >
        Ver repositório no GitHub{' '}
        <span className="sr-only">(abre em nova aba)</span>
        <span aria-hidden="true"> ↗</span>
      </a>
    </article>
  )
}

export default RepositoryDetail
