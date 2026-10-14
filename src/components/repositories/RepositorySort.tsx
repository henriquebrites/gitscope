import { useId } from 'react'
import type { SortKey } from '../../types/github'

const options: [SortKey, string][] = [
  ['stars-desc', 'Mais estrelas'],
  ['stars-asc', 'Menos estrelas'],
  ['name-asc', 'Nome'],
  ['updated-desc', 'Atualização'],
]

interface RepositorySortProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

/**
 * Native radios drawn as pills: the browser moves the choice with the arrow keys, and the
 * focus ring lands on the input, which covers its pill.
 */
function RepositorySort({ sort, onSortChange }: RepositorySortProps) {
  const name = useId()

  return (
    <div role="radiogroup" aria-label="Ordenar por" className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <label
          key={value}
          className="relative inline-flex h-8 items-center rounded-pill border border-hairline bg-canvas-elevated px-3 text-label-sm text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary"
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={sort === value}
            onChange={() => onSortChange(value)}
            className="absolute inset-0 cursor-pointer appearance-none rounded-pill"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

export default RepositorySort
