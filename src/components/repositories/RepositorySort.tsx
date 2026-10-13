import { useId } from 'react'
import type { SortKey } from '../../types/github'

const options: [SortKey, string][] = [
  ['stars-desc', 'Estrelas — maior para menor'],
  ['stars-asc', 'Estrelas — menor para maior'],
  ['name-asc', 'Nome — A a Z'],
  ['updated-desc', 'Atualização — mais recente'],
]

interface RepositorySortProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

function RepositorySort({ sort, onSortChange }: RepositorySortProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-sm text-ink">
        Ordenar por
      </label>
      <select
        id={id}
        value={sort}
        onChange={(event) => onSortChange(event.target.value as SortKey)}
        className="h-10 rounded-sm border border-hairline bg-canvas-elevated px-3 text-body-md text-ink"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default RepositorySort
