import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <>
      <h1 className="text-heading-lg text-ink">Página não encontrada</h1>
      <p className="text-body-lg text-body">
        Este endereço não corresponde a nenhuma página do GitHub Explorer.
      </p>
      <Link to="/" className="self-start rounded-sm text-body-md text-link underline">
        Voltar ao início
      </Link>
    </>
  )
}

export default NotFoundPage
