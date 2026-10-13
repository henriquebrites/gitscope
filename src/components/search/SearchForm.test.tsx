import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SearchForm from './SearchForm'

function renderForm(isLoading = false) {
  const onSearch = vi.fn()
  const view = render(<SearchForm isLoading={isLoading} onSearch={onSearch} />)
  const field = screen.getByRole('textbox', { name: 'Nome de usuário do GitHub' })
  return { ...view, onSearch, field }
}

function describedBy(field: HTMLElement): string {
  const ids = field.getAttribute('aria-describedby')?.split(/\s+/) ?? []
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
}

describe('SearchForm', () => {
  it('labels the field and links the hint', () => {
    const { field } = renderForm()

    const label = document.querySelector(`label[for="${field.id}"]`)
    expect(label).toHaveTextContent('Nome de usuário do GitHub')
    expect(field).toHaveAccessibleName('Nome de usuário do GitHub')
    expect(field.getAttribute('placeholder') ?? '').not.toBe('Nome de usuário do GitHub')
    expect(describedBy(field)).toMatch(/login/i)
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['empty', 'click', ''],
    ['empty', 'enter', ''],
    ['spaces only', 'click', '   '],
    ['spaces only', 'enter', '   '],
  ])('rejects a blank search (%s via %s)', async (_label, trigger, typed) => {
    const user = userEvent.setup()
    const { field, onSearch } = renderForm()

    if (typed) await user.type(field, typed)
    if (trigger === 'click') await user.click(screen.getByRole('button', { name: 'Buscar' }))
    else await user.type(field, '{Enter}')

    expect(onSearch).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(field)).toContain('Digite um nome de usuário para buscar.')
    expect(field).toHaveFocus()
  })

  it('trims the login', async () => {
    const user = userEvent.setup()
    const { field, onSearch } = renderForm()

    await user.type(field, '  octocat  {Enter}')

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('octocat')
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('loading state disables the button and blocks submission', async () => {
    const user = userEvent.setup()
    const { field, onSearch, rerender } = renderForm(true)

    const busy = screen.getByRole('button', { name: 'Buscando…' })
    expect(busy).toBeDisabled()
    await user.type(field, 'octocat{Enter}')
    expect(onSearch).not.toHaveBeenCalled()

    rerender(<SearchForm isLoading={false} onSearch={onSearch} />)
    const ready = screen.getByRole('button', { name: 'Buscar' })
    expect(ready).toBeEnabled()
    await user.click(ready)
    expect(onSearch).toHaveBeenCalledWith('octocat')
  })
})
