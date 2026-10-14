import { useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchForm from '../components/search/SearchForm'
import { useGitHub } from '../context/GitHubContext'
import { isProfileLoading } from '../context/githubReducer'

// Avatars by account id, so the image is served directly, without a redirect.
const examples = [
  { login: 'octocat', avatar: 'https://avatars.githubusercontent.com/u/583231?s=48&v=4' },
  { login: 'torvalds', avatar: 'https://avatars.githubusercontent.com/u/1024025?s=48&v=4' },
  { login: 'gaearon', avatar: 'https://avatars.githubusercontent.com/u/810438?s=48&v=4' },
]

function HomePage() {
  const navigate = useNavigate()
  const { state } = useGitHub()
  const examplesId = useId()

  return (
    <section aria-label="Início" className="flex flex-col gap-6 sm:py-10">
      <div className="relative">
        {/* Decoration behind the title only: it never sits under body text. */}
        <div aria-hidden="true" data-testid="hero-glow" className="hero-glow pointer-events-none absolute inset-0" />
        <h1 className="relative text-heading-lg text-ink sm:text-display-xl">
          Qualquer perfil do GitHub, em um só lugar.
        </h1>
      </div>
      <p className="max-w-xl text-body-lg text-body">
        Perfil público, todos os repositórios ordenados e o README de cada projeto.
      </p>
      <SearchForm
        variant="hero"
        isLoading={isProfileLoading(state)}
        onSearch={(login) => navigate(`/users/${encodeURIComponent(login)}`)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <p id={examplesId} className="font-mono text-mono-eyebrow text-mute uppercase">
          Experimente
        </p>
        <ul aria-labelledby={examplesId} className="flex flex-wrap gap-2">
          {examples.map(({ login, avatar }) => (
            <li key={login}>
              <Link
                to={`/users/${login}`}
                className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-canvas-elevated py-1 pr-3 pl-1 text-label-sm text-ink hover:border-mute"
              >
                <img src={avatar} alt="" width={24} height={24} className="size-6 rounded-full bg-hairline-soft" />
                {login}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default HomePage
