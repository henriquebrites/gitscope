import { Link } from 'react-router-dom'

function RouteErrorPage() {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <h1 className="text-heading-lg text-ink">Algo deu errado</h1>
      <p className="text-body-lg text-body">
        Não foi possível exibir esta página. Volte ao início ou faça uma nova busca.
      </p>
      <Link to="/" className="self-start rounded-sm text-body-md text-link underline">
        Voltar ao início
      </Link>
    </section>
  )
}

export default RouteErrorPage
