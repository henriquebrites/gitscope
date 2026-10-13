import { useId, useRef, useState, type FormEvent } from 'react'

interface SearchFormProps {
  isLoading: boolean
  onSearch: (login: string) => void
}

function SearchForm({ isLoading, onSearch }: SearchFormProps) {
  const [value, setValue] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

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
      className="flex w-full flex-col gap-1 sm:max-w-sm"
    >
      <label htmlFor={fieldId} className="text-label-sm text-ink">
        Nome de usuário do GitHub
      </label>
      <div className="flex gap-2">
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
          aria-describedby={isInvalid ? `${hintId} ${errorId}` : hintId}
          className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-canvas-elevated px-3 text-body-md text-ink placeholder:text-mute aria-invalid:border-error"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="h-10 shrink-0 rounded-sm bg-primary px-3 text-button-md text-on-primary disabled:cursor-not-allowed disabled:bg-mute"
        >
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      <p id={hintId} className="text-body-sm text-mute">
        Use o login exato da conta, por exemplo octocat.
      </p>
      {isInvalid && (
        <p id={errorId} role="alert" className="text-body-sm text-error">
          Digite um nome de usuário para buscar.
        </p>
      )}
    </form>
  )
}

export default SearchForm
