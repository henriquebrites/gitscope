interface RepositoryPagerProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const buttonClass =
  'h-10 shrink-0 rounded-sm border border-hairline bg-canvas-elevated px-4 text-button-md text-ink disabled:cursor-not-allowed disabled:bg-hairline-soft disabled:text-mute'

function RepositoryPager({ page, totalPages, onPageChange }: RepositoryPagerProps) {
  return (
    <nav aria-label="Páginas de repositórios" className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={buttonClass}
      >
        Anterior
      </button>
      <p aria-current="page" className="text-body-md text-ink">
        Página {page} de {totalPages}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={buttonClass}
      >
        Próxima
      </button>
    </nav>
  )
}

export default RepositoryPager
