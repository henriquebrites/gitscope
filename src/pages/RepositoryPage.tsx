import { Link, useLocation, useParams } from 'react-router-dom'
import RepositoryDetailSection from '../components/repositories/RepositoryDetailSection'
import { useRepository } from '../hooks/useRepository'
import { listSearchFrom } from '../utils/listSearch'

function RepositoryPage() {
  const { username = '', repoName = '' } = useParams()
  const { state } = useLocation()
  const { result, retry } = useRepository(username, repoName)

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
    </>
  )
}

export default RepositoryPage
