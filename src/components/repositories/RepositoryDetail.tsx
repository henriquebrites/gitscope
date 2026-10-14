import type { Repository } from '../../types/github'
import { formatCount } from '../../utils/formatters'
import LanguageDot from './LanguageDot'

const pillClass =
  'inline-flex h-8 items-center rounded-pill border border-hairline px-3 text-label-sm text-ink'

function RepositoryDetail({ repository }: { repository: Repository }) {
  const { name, description, stargazers_count, language, html_url } = repository

  return (
    <article className="overflow-hidden rounded-lg border border-hairline bg-canvas-elevated">
      <div aria-hidden="true" data-testid="repository-band" className="gradient-vitrine h-1" />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-heading-lg break-words text-ink">{name}</h1>
        <p className={`text-body-lg break-words ${description ? 'text-body' : 'text-mute'}`}>
          {description ?? 'Sem descrição.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p data-testid="repository-stars" className={`${pillClass} tabular-nums`}>
            <span aria-hidden="true">★</span>&nbsp;{formatCount(stargazers_count)}
            <span className="sr-only"> estrelas</span>
          </p>
          {language && (
            <p data-testid="repository-language" className={`${pillClass} min-w-0 break-all`}>
              <LanguageDot language={language} />
            </p>
          )}
          <a
            href={html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-body-md text-link underline sm:ml-auto"
          >
            Ver repositório no GitHub{' '}
            <span className="sr-only">(abre em nova aba)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </div>
    </article>
  )
}

export default RepositoryDetail
