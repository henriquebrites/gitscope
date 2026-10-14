import { useEffect, useRef } from 'react'
import { pagerItems } from '../../utils/pagination'

interface RepositoryPagerProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const buttonClass =
  'h-10 shrink-0 rounded-sm border border-hairline bg-canvas-elevated px-4 text-button-md text-ink disabled:cursor-not-allowed disabled:bg-hairline-soft disabled:text-mute'

const numberClass = 'h-10 min-w-10 shrink-0 rounded-sm border px-3 text-button-md tabular-nums'

/** Numbered from 640px; below it, "p de N" between the two arrows. */
function RepositoryPager({ page, totalPages, onPageChange }: RepositoryPagerProps) {
  const previousRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const numberRefs = useRef(new Map<number, HTMLButtonElement>())
  // Set before a change whose target would otherwise lose the focus: a limit button that turns
  // disabled, or a number the re-render may move.
  const focusAfterChange = useRef<(() => HTMLButtonElement | null | undefined) | null>(null)

  useEffect(() => {
    focusAfterChange.current?.()?.focus()
    focusAfterChange.current = null
  }, [page])

  function goTo(target: number) {
    if (target <= 1) focusAfterChange.current = () => nextRef.current
    else if (target >= totalPages) focusAfterChange.current = () => previousRef.current
    onPageChange(target)
  }

  function goToNumber(target: number) {
    focusAfterChange.current = () => numberRefs.current.get(target)
    onPageChange(target)
  }

  return (
    <nav aria-label="Páginas de repositórios" className="flex items-center justify-between gap-3 sm:justify-center">
      <button
        ref={previousRef}
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className={buttonClass}
      >
        Anterior
      </button>
      <div data-testid="pager-numbers" className="hidden items-center gap-2 sm:flex">
        {pagerItems(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-body-md text-mute">
              …
            </span>
          ) : (
            <button
              key={item}
              ref={(element) => {
                if (element) numberRefs.current.set(item, element)
                else numberRefs.current.delete(item)
              }}
              type="button"
              aria-label={`Página ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => (item === page ? undefined : goToNumber(item))}
              className={`${numberClass} ${
                item === page
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-hairline bg-canvas-elevated text-ink'
              }`}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <p data-testid="pager-compact" className="text-body-md text-ink tabular-nums sm:hidden">
        {page} de {totalPages}
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
