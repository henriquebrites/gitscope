import { useId, useRef, useState, type FormEvent } from 'react'

/** `hero`: the large search of the home page, hint visible. `header`: one compact row. */
export type SearchVariant = 'hero' | 'header'

interface SearchFormProps {
  isLoading: boolean
  onSearch: (login: string) => void
  variant?: SearchVariant
}

const styles = {
  hero: {
    form: 'flex w-full max-w-xl flex-col gap-2',
    row: 'flex items-center gap-2 rounded-pill border border-hairline bg-canvas-elevated p-1 pl-4 has-aria-invalid:border-error',
    field: 'h-10 min-w-0 flex-1 rounded-sm bg-transparent text-body-lg text-ink placeholder:text-mute',
    button: 'h-10 shrink-0 rounded-pill bg-primary px-6 text-button-lg text-on-primary disabled:cursor-not-allowed disabled:bg-mute',
    hint: 'text-body-md text-mute',
  },
  header: {
    form: 'flex w-full flex-col gap-1 sm:w-auto sm:flex-1',
    row: 'flex gap-2',
    field: 'h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-canvas-elevated px-3 text-body-md text-ink placeholder:text-mute aria-invalid:border-error',
    button: 'h-10 shrink-0 rounded-sm bg-primary px-3 text-button-md text-on-primary disabled:cursor-not-allowed disabled:bg-mute',
    hint: 'sr-only',
  },
}

function SearchForm({ isLoading, onSearch, variant = 'header' }: SearchFormProps) {
  const [value, setValue] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const style = styles[variant]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    const login = value.trim()
    if (!login) {
      setIsInvalid(true)
      fieldRef.current?.focus()
      return
    }
    setIsInvalid(false)
    onSearch(login)
  }

  return (
    <form
      role="search"
      aria-label="Buscar usuário do GitHub"
      noValidate
      onSubmit={handleSubmit}
      className={style.form}
    >
      <label htmlFor={fieldId} className="sr-only">
        Nome de usuário do GitHub
      </label>
      <div data-testid="search-row" className={style.row}>
        <input
          ref={fieldRef}
          id={fieldId}
          type="text"
          name="login"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            if (event.target.value.trim()) setIsInvalid(false)
          }}
          placeholder="octocat"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? `${errorId} ${hintId}` : hintId}
          className={style.field}
        />
        <button type="submit" disabled={isLoading} className={style.button}>
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {isInvalid && (
        <p id={errorId} role="alert" className="text-body-sm text-error">
          Digite um nome de usuário para buscar.
        </p>
      )}
      <p id={hintId} className={style.hint}>
        Use o login exato da conta, por exemplo octocat.
      </p>
    </form>
  )
}

export default SearchForm
