import { useParams } from 'react-router-dom'

// Placeholder until T4 loads the repository.
function RepositoryPage() {
  const { username = '', repoName = '' } = useParams()

  return (
    <>
      <p className="font-mono text-mono-eyebrow break-words text-mute uppercase">{username}</p>
      <h1 className="text-heading-lg break-words text-ink">{repoName}</h1>
      <p className="text-body-lg text-body">Os detalhes deste repositório aparecem aqui.</p>
    </>
  )
}

export default RepositoryPage
