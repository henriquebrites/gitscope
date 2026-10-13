import { useParams, useSearchParams } from 'react-router-dom'
import ProfileSection from '../components/profile/ProfileSection'
import RepositorySection from '../components/repositories/RepositorySection'
import { useProfile } from '../hooks/useProfile'
import { useRepositories } from '../hooks/useRepositories'
import { parseSort } from '../utils/pagination'

function UserPage() {
  const { username = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = useProfile(username)
  const hasProfile = profile.result.status === 'success'
  const repositories = useRepositories(username, hasProfile)

  return (
    <>
      <ProfileSection result={profile.result} login={username} onRetry={profile.retry} />
      {hasProfile && (
        <RepositorySection
          result={repositories.result}
          login={username}
          sort={parseSort(searchParams.get('sort'))}
          pageParam={searchParams.get('page')}
          // Sorting starts over at page 1; paging keeps the sort. Both stay in the history.
          onSortChange={(sort) => setSearchParams({ sort, page: '1' })}
          onPageChange={(page) =>
            setSearchParams((params) => {
              params.set('page', String(page))
              return params
            })
          }
          onRetry={repositories.retry}
        />
      )}
    </>
  )
}

export default UserPage
