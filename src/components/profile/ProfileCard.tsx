import type { Profile } from '../../types/github'
import { formatCount } from '../../utils/formatters'

function ProfileCard({ profile }: { profile: Profile }) {
  const { login, name, avatar_url, html_url, bio, email, followers, following } = profile

  return (
    <article className="flex flex-col gap-6 rounded-md border border-hairline bg-canvas-elevated p-6 sm:flex-row sm:items-start">
      <img
        src={avatar_url}
        alt={`Avatar de ${login}`}
        width={96}
        height={96}
        className="size-24 shrink-0 rounded-full border border-hairline bg-hairline-soft"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-lg break-words text-ink">{login}</h1>
          {name && <p className="text-body-lg break-words text-body">{name}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-body-md">
          <div className="flex gap-1">
            <dt className="text-mute">Seguidores</dt>
            <dd className="text-label-sm text-ink">{formatCount(followers)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-mute">Seguindo</dt>
            <dd className="text-label-sm text-ink">{formatCount(following)}</dd>
          </div>
        </dl>
        <p className={`text-body-md break-words ${bio ? 'text-body' : 'text-mute'}`}>
          {bio ?? 'Sem bio.'}
        </p>
        <div className="flex flex-col items-start gap-2">
          {email && (
            <a
              href={`mailto:${email}`}
              className="max-w-full rounded-sm text-body-md break-all text-link underline"
            >
              {email}
            </a>
          )}
          <a
            href={html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-body-md text-link underline"
          >
            Ver perfil no GitHub{' '}
            <span className="sr-only">(abre em nova aba)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </div>
    </article>
  )
}

export default ProfileCard
