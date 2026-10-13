import { useEffect, useRef } from 'react'

interface RepositoryPagerProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const buttonClass =
  'h-10 shrink-0 rounded-sm border border-hairline bg-canvas-elevated px-4 text-button-md text-ink disabled:cursor-not-allowed disabled:bg-hairline-soft disabled:text-mute'

function RepositoryPager({ page, totalPages, onPageChange }: RepositoryPagerProps) {
  const previousRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // Set when a click reaches a limit: that button turns disabled and would drop the focus.
  const focusAfterChange = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    focusAfterChange.current?.focus()
    focusAfterChange.current = null
  }, [page])

  function goTo(target: number) {
    if (target <= 1) focusAfterChange.current = nextRef.current
    else if (target >= totalPages) focusAfterChange.current = previousRef.current
    onPageChange(target)
  }

  return (
    <nav aria-label="Páginas de repositórios" className="flex items-center justify-between gap-3">
      <button
        ref={previousRef}
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className={buttonClass}
      >
        Anterior
      </button>
      <p aria-current="page" className="text-body-md text-ink">
        Página {page} de {totalPages}
      </p>
      <button
        ref={nextRef}
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className={buttonClass}
      >
        Próxima
      </button>
    </nav>
  )
}

export default RepositoryPager
