import type { Page } from '@playwright/test'
import { json, octocat, pagedRepositories, repositoriesOf, repositoryOf, stubGitHub } from './support/github.js'
import { expect, test } from './support/test.js'
import { expectPage, sortPill } from './support/pager.js'

const profileHeading = (page: Page, login = 'octocat') =>
  page.getByRole('region', { name: 'Perfil' }).getByRole('heading', { level: 1, name: login })
const repositories = (page: Page) => page.getByRole('region', { name: 'Repositórios' })
// Each screen has one search: the hero's on the home page, the header's elsewhere.
const searchField = (page: Page) =>
  page.getByRole('search').getByRole('textbox', { name: 'Nome de usuário do GitHub' })

/** Counts requests to the profile and to the repository list endpoints. */
function countApiRequests(page: Page) {
  const counts = { users: 0, repositoryPages: 0, repository: 0 }
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== 'api.github.com') return
    if (/^\/users\/[^/]+$/.test(url.pathname)) counts.users += 1
    else if (/^\/users\/[^/]+\/repos$/.test(url.pathname)) counts.repositoryPages += 1
    else if (/^\/repos\/[^/]+\/[^/]+$/.test(url.pathname)) counts.repository += 1
  })
  return counts
}

test('flow A: search to sorted profile', async ({ page }) => {
  await stubGitHub(
    page,
    undefined,
    pagedRepositories([
      repositoryOf('mid', { stargazers_count: 50 }),
      repositoryOf('low', { stargazers_count: 3 }),
      repositoryOf('top', { stargazers_count: 900 }),
    ]),
  )
  await page.goto('/')

  await searchField(page).fill('  octocat  ')
  await searchField(page).press('Enter')

  await expect(page).toHaveURL('/users/octocat')
  await expect(profileHeading(page)).toBeVisible()
  await expect(repositories(page).getByRole('listitem')).toHaveCount(3)
  const names = await repositories(page).getByRole('listitem').getByRole('link').allTextContents()
  expect(names).toEqual(['top', 'mid', 'low'])
  await expect(sortPill(repositories(page), 'Mais estrelas')).toBeChecked()
})

test('flow A: repositories failure keeps the profile', async ({ page }) => {
  let attempts = 0
  await stubGitHub(page, undefined, (route, login, pageNumber) => {
    attempts += 1
    if (attempts === 1) return json(route, { message: 'Server Error' }, 500)
    return pagedRepositories([repositoryOf('recovered')])(route, login, pageNumber)
  })
  await page.goto('/users/octocat')

  await expect(repositories(page).getByRole('heading', { name: 'Algo deu errado' })).toBeVisible()
  await expect(profileHeading(page)).toBeVisible()

  await repositories(page).getByRole('button', { name: 'Tentar novamente' }).click()

  await expect(repositories(page).getByRole('link', { name: 'recovered' })).toBeVisible()
  await expect(profileHeading(page)).toBeVisible()
})

test('flow B: sort, open, back, external link', async ({ page }) => {
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  const counts = countApiRequests(page)
  await page.goto('/users/octocat')
  await expectPage(page, repositories(page), 1, 2)

  // The URL drives the checked pill, so it turns checked once the navigation lands.
  await sortPill(repositories(page), 'Nome').click()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=1')
  await expect(repositories(page).getByRole('listitem').first()).toContainText('r-001')
  expect(counts).toEqual({ users: 1, repositoryPages: 1, repository: 0 })

  await repositories(page).getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await repositories(page).getByRole('link', { name: 'r-031' }).click()

  await expect(page).toHaveURL('/users/octocat/repos/r-031')
  await expect(page.getByRole('heading', { level: 1, name: 'r-031' })).toBeVisible()
  const external = page.getByRole('link', { name: 'Ver repositório no GitHub (abre em nova aba)' })
  await expect(external).toHaveAttribute('href', 'https://github.com/octocat/r-031')
  await expect(external).toHaveAttribute('target', '_blank')
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer')

  await page.getByRole('link', { name: 'Voltar aos repositórios' }).click()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await expectPage(page, repositories(page), 2, 2)
  await expect(sortPill(repositories(page), 'Nome')).toBeChecked()
  expect(counts).toEqual({ users: 1, repositoryPages: 1, repository: 0 })
})

test('flow C: not found then a new search', async ({ page }) => {
  await stubGitHub(page, (route, login) =>
    login === 'ghost'
      ? json(route, { message: 'Not Found' }, 404)
      : json(route, { ...octocat, login, html_url: `https://github.com/${login}` }),
  )
  await page.goto('/users/ghost')
  await expect(page.getByRole('heading', { level: 1, name: 'Conta não encontrada' })).toBeVisible()

  await searchField(page).fill('octocat')
  await searchField(page).press('Enter')

  await expect(page).toHaveURL('/users/octocat')
  await expect(profileHeading(page)).toBeVisible()
  await expect(page.getByText('Conta não encontrada')).toHaveCount(0)
})

test('flow C: network failure then retry', async ({ page }) => {
  let attempts = 0
  await stubGitHub(page, (route, login) => {
    attempts += 1
    if (attempts === 1) return route.abort('internetdisconnected')
    return json(route, { ...octocat, login })
  })
  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible()

  await page.getByRole('button', { name: 'Tentar novamente' }).click()

  await expect(profileHeading(page)).toBeVisible()
  await expect(page.getByText('Sem conexão')).toHaveCount(0)
  expect(attempts).toBe(2)
})

test('direct access and refresh: profile', async ({ page }) => {
  await stubGitHub(page)

  await page.goto('/users/octocat')
  await expect(profileHeading(page)).toBeVisible()
  await page.reload()
  await expect(profileHeading(page)).toBeVisible()
})

test('direct access and refresh: detail', async ({ page }) => {
  await stubGitHub(page)

  await page.goto('/users/octocat/repos/Hello-World')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
})

test.describe('rate-limited', () => {
  test.use({ timezoneId: 'America/Sao_Paulo' })

  test('rate-limited shows the reset time', async ({ page }) => {
    const reset = Date.UTC(2026, 9, 13, 15, 42) / 1000
    const users = await stubGitHub(page, (route) =>
      json(route, { message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(reset),
      }),
    )
    await page.goto('/users/octocat')

    await expect(page.getByRole('heading', { level: 1, name: 'Limite de consultas atingido' })).toBeVisible()
    await expect(page.getByText('As consultas voltam a ser liberadas às 12:42.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)
    expect(users).toEqual(['octocat'])
  })
})
