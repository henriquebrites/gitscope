import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useGitHub } from '../../context/GitHubContext'
import { isProfileLoading } from '../../context/githubReducer'
import SearchForm from '../search/SearchForm'

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useGitHub()

  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <Link
          to="/"
          className="self-start rounded-sm py-1 font-mono text-mono-eyebrow text-ink uppercase"
        >
          GitHub Explorer
        </Link>
        {/* Keyed by location so the field starts empty on every navigation. */}
        <SearchForm
          key={location.key}
          isLoading={isProfileLoading(state)}
          onSearch={(login) => navigate(`/users/${encodeURIComponent(login)}`)}
        />
      </div>
    </header>
  )
}

export default AppHeader
