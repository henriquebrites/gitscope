import { Link, useLocation, useParams } from 'react-router-dom'
import RepositoryDetailSection from '../components/repositories/RepositoryDetailSection'
import RepositoryReadme from '../components/repositories/RepositoryReadme'
import { useReadme } from '../hooks/useReadme'
import { useRepository } from '../hooks/useRepository'
import { listSearchFrom } from '../utils/listSearch'

function RepositoryPage() {
  const { username = '', repoName = '' } = useParams()
  const { state } = useLocation()
  const { result, retry } = useRepository(username, repoName)
  // Asked only once the repository is on screen: never for a failed or missing one.
  const readme = useReadme(username, repoName, result.status === 'success')

  return (
    <>
      <Link
        to={`/users/${encodeURIComponent(username)}${listSearchFrom(state)}`}
        className="self-start rounded-sm text-body-md text-link underline"
      >
        <span aria-hidden="true">← </span>
        Voltar aos repositórios
      </Link>
      <RepositoryDetailSection result={result} login={username} onRetry={retry} />
      {readme.result.status !== 'idle' && <RepositoryReadme result={readme.result} onRetry={readme.retry} />}
    </>
  )
}

export default RepositoryPage
