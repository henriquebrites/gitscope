import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useGitHub } from '../../context/GitHubContext'
import { isProfileLoading } from '../../context/githubReducer'
import SearchForm from '../search/SearchForm'
import ThemeToggle from './ThemeToggle'

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useGitHub()
  // The home page has its own search in the hero: one search per screen.
  const isHome = location.pathname === '/'

  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <Link
          to="/"
          className="mr-auto shrink-0 rounded-sm py-1 font-mono text-mono-eyebrow whitespace-nowrap text-ink uppercase"
        >
          GitHub Explorer
        </Link>
        {isHome ? (
          <ThemeToggle />
        ) : (
          <>
            {/* Two placements, one shown per layout, so the Tab order follows the visual order:
                beside the wordmark on the first of two rows below 640px, last on the one row above. */}
            <ThemeToggle className="inline-flex sm:hidden" />
            {/* Keyed by location so the field starts empty on every navigation. */}
            <SearchForm
              key={location.key}
              isLoading={isProfileLoading(state)}
              onSearch={(login) => navigate(`/users/${encodeURIComponent(login)}`)}
            />
            <ThemeToggle className="hidden sm:inline-flex" />
          </>
        )}
      </div>
    </header>
  )
}

export default AppHeader
