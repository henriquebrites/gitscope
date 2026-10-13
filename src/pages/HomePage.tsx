function HomePage() {
  return (
    <>
      <h1 className="text-heading-lg text-ink sm:text-display-xl">Explore perfis do GitHub</h1>
      <p className="text-body-lg text-body">
        Digite um nome de usuário no campo de busca para ver o perfil público e os repositórios
        da conta.
      </p>
      <section className="rounded-md border border-hairline bg-canvas-elevated p-6">
        <h2 className="text-heading-md text-ink">Como buscar</h2>
        <p className="mt-2 text-body-md text-body">
          Use o login exato, como aparece no endereço do perfil no GitHub: em
          github.com/octocat, o login é octocat. Espaços no início e no fim são ignorados.
        </p>
      </section>
    </>
  )
}

export default HomePage
