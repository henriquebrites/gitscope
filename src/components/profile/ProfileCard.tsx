import type { Profile } from '../../types/github'
import { formatCount } from '../../utils/formatters'

function ProfileCard({ profile }: { profile: Profile }) {
  const { login, name, avatar_url, html_url, bio, email, followers, following, public_repos } = profile
  const tiles: [string, number][] = [
    ['Seguidores', followers],
    ['Seguindo', following],
    ['Repositórios', public_repos],
  ]

  return (
    <article className="overflow-hidden rounded-lg border border-hairline bg-canvas-elevated">
      <div aria-hidden="true" data-testid="profile-cover" className="gradient-vitrine h-24" />
      <div className="flex flex-col gap-4 px-3 pb-6 sm:px-6">
        <img
          src={avatar_url}
          alt={`Avatar de ${login}`}
          width={96}
          height={96}
          className="-mt-10 size-24 shrink-0 rounded-full border-4 border-canvas-elevated bg-hairline-soft"
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-lg break-words text-ink">{login}</h1>
          {name && <p className="text-body-lg break-words text-body">{name}</p>}
        </div>
        <p className={`text-body-md break-words ${bio ? 'text-body' : 'text-mute'}`}>{bio ?? 'Sem bio.'}</p>
        <dl className="grid grid-cols-3 gap-2">
          {tiles.map(([label, value]) => (
            // Value above its label, as on the design; the term stays first for screen readers.
            <div
              key={label}
              data-testid="profile-tile"
              className="flex min-w-0 flex-col-reverse gap-1 rounded-md border border-hairline bg-canvas p-2 sm:px-3"
            >
              <dt className="text-body-sm text-mute">{label}</dt>
              <dd className="text-label-sm whitespace-nowrap text-ink tabular-nums sm:text-heading-md">
                {formatCount(value)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
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
