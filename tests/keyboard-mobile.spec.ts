import type { Locator, Page } from '@playwright/test'
import { json, octocat, pagedRepositories, repositoriesOf, stubGitHub } from './support/github.js'
import { expect, test } from './support/test.js'

test.use({ viewport: { width: 320, height: 480 } })

const repositories = (page: Page) => page.getByRole('region', { name: 'Repositórios' })

/** Presses Tab until `target` has the focus; fails if it never gets it. */
async function tabTo(page: Page, target: Locator, maxSteps = 60) {
  for (let step = 0; step < maxSteps; step += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error(`Tab never reached ${target}`)
}

const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

test.describe('no horizontal scroll', () => {
  test('no horizontal scroll: home', async ({ page }) => {
    await stubGitHub(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
  })

  test('no horizontal scroll: profile with list', async ({ page }) => {
    await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('repositorio-de-nome-longo', 45)))
    await page.goto('/users/octocat')
    await expect(repositories(page).getByText('Página 1 de 2')).toBeVisible()
    expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
  })

  test('no horizontal scroll: detail', async ({ page }) => {
    await stubGitHub(page)
    await page.goto('/users/octocat/repos/Hello-World')
    await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
    expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
  })
})

test('keyboard: search', async ({ page }) => {
  await stubGitHub(page)
  await page.goto('/')

  await tabTo(page, page.getByRole('textbox', { name: 'Nome de usuário do GitHub' }))
  await page.keyboard.type('octocat')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
})

test('keyboard: sort and pagination', async ({ page }) => {
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  await page.goto('/users/octocat')
  await expect(repositories(page).getByText('Página 1 de 2')).toBeVisible()

  const sort = repositories(page).getByRole('combobox', { name: 'Ordenar por' })
  await tabTo(page, sort)
  // Typeahead picks "Nome — A a Z"; arrows on a closed select do nothing on macOS.
  await page.keyboard.press('n')

  await expect(sort).toHaveValue('name-asc')
  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=1')
  await expect(repositories(page).getByRole('listitem').first()).toContainText('r-001')

  await tabTo(page, repositories(page).getByRole('button', { name: 'Próxima' }))
  await page.keyboard.press('Enter')
  await expect(repositories(page).getByText('Página 2 de 2')).toBeVisible()
  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')

  // At the last page the focus moves to "Anterior" (T3).
  await expect(repositories(page).getByRole('button', { name: 'Anterior' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(repositories(page).getByText('Página 1 de 2')).toBeVisible()
})

test('keyboard: retry', async ({ page }) => {
  let attempts = 0
  await stubGitHub(page, (route, login) => {
    attempts += 1
    if (attempts === 1) return route.abort('internetdisconnected')
    return json(route, { ...octocat, login })
  })
  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible()

  await tabTo(page, page.getByRole('button', { name: 'Tentar novamente' }))
  await page.keyboard.press('Space')

  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  expect(attempts).toBe(2)
})
