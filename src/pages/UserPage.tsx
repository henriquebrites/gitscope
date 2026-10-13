import { useParams } from 'react-router-dom'

// Placeholder until T2 fetches the profile.
function UserPage() {
  const { username = '' } = useParams()

  return (
    <>
      <h1 className="text-heading-lg break-words text-ink">{username}</h1>
      <p className="text-body-lg text-body">O perfil público desta conta aparece aqui.</p>
    </>
  )
}

export default UserPage
