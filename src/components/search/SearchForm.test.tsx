import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SearchForm, { type SearchVariant } from './SearchForm'

function renderForm(isLoading = false, variant: SearchVariant = 'header') {
  const onSearch = vi.fn()
  const view = render(<SearchForm isLoading={isLoading} onSearch={onSearch} variant={variant} />)
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

  it.each(
    (['hero', 'header'] as const).flatMap((variant) => [
      [variant, 'empty', 'click', ''],
      [variant, 'empty', 'enter', ''],
      [variant, 'spaces only', 'click', '   '],
      [variant, 'spaces only', 'enter', '   '],
    ]),
  )('rejects a blank search (%s, %s via %s)', async (variant, _label, trigger, typed) => {
    const user = userEvent.setup()
    const { field, onSearch } = renderForm(false, variant)

    if (typed) await user.type(field, typed)
    if (trigger === 'click') await user.click(screen.getByRole('button', { name: 'Buscar' }))
    else await user.type(field, '{Enter}')

    expect(onSearch).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(field)).toContain('Digite um nome de usuário para buscar.')
    expect(field).toHaveFocus()
    // Visible, right under the field's row: the next element after it.
    const error = screen.getByText('Digite um nome de usuário para buscar.')
    expect(error).not.toHaveClass('sr-only')
    expect(screen.getByTestId('search-row').nextElementSibling).toBe(error)
  })

  it('hint: visible in the hero, for screen readers only in the header', () => {
    const hint = 'Use o login exato da conta, por exemplo octocat.'
    const hero = renderForm(false, 'hero')
    expect(screen.getByText(hint)).not.toHaveClass('sr-only')
    hero.unmount()

    renderForm(false, 'header')
    expect(screen.getByText(hint)).toHaveClass('sr-only')
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
