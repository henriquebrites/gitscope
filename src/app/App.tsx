function App() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-180 flex-col gap-lg px-md py-3xl">
      <p className="font-mono text-mono-eyebrow text-mute uppercase">GitHub Explorer</p>
      <h1 className="text-heading-lg text-ink sm:text-display-xl">Explore perfis do GitHub</h1>
      <p className="text-body-lg text-body">
        Pesquise um nome de usuário para ver o perfil público e os repositórios.
      </p>
      <section className="rounded-md border border-hairline bg-canvas-elevated p-lg">
        <h2 className="text-heading-md text-ink">Em construção</h2>
        <p className="mt-xs text-body-md text-body">A busca chega na próxima etapa.</p>
      </section>
    </main>
  )
}

export default App
