import { useParams } from 'react-router-dom'
import ProfileSection from '../components/profile/ProfileSection'
import { useProfile } from '../hooks/useProfile'

function UserPage() {
  const { username = '' } = useParams()
  const { result, retry } = useProfile(username)

  return <ProfileSection result={result} login={username} onRetry={retry} />
}

export default UserPage
