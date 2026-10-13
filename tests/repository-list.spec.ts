import { expect, test, type Page } from '@playwright/test'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'
import {
  json,
  pagedRepositories,
  repositoriesOf,
  repositoryOf,
  stubGitHub,
  type RepositoriesHandler,
} from './support/github.js'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

const longWord = 'repositorio-com-um-nome-de-palavra-unica-extremamente-comprida-para-quebrar'

/** 45 repositories: two visual pages, the first led by long unbroken texts. */
const paginated = [
  repositoryOf(longWord, {
    stargazers_count: 1234567,
    description: `${longWord}-${longWord} `.repeat(3),
    language: 'Linguagem-de-programacao-com-nome-comprido',
  }),
  ...repositoriesOf('repo', 44),
]

interface SectionState {
  name: string
  handler: RepositoriesHandler
  /** Text that tells the state has rendered. */
  ready: (page: Page) => ReturnType<Page['getByText']>
}

const section = (page: Page) => page.getByRole('region', { name: 'Repositórios' })

const states: SectionState[] = [
  {
    name: 'loading',
    handler: () => new Promise<void>(() => {}),
    ready: (page) => section(page).getByText('Carregando repositórios… (página 1)'),
  },
  {
    name: 'paginated list with long names',
    handler: pagedRepositories(paginated),
    ready: (page) => section(page).getByText(/^Página [12] de 2$/),
  },
  {
    name: 'empty',
    handler: (route) => json(route, []),
    ready: (page) => section(page).getByText('Esta conta não tem repositórios públicos.'),
  },
  {
    name: 'error',
    handler: (route) => json(route, { message: 'Server Error' }, 500),
    ready: (page) => section(page).getByRole('heading', { name: 'Algo deu errado' }),
  },
]

async function openState(page: Page, state: SectionState, path = '/users/octocat') {
  await stubGitHub(page, undefined, state.handler)
  await page.goto(path)
  await expect(state.ready(page)).toBeVisible()
}

for (const state of states) {
  test.describe(`repositories: ${state.name}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await openState(page, state)

      await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(320)
    })
  })
}

for (const state of states.filter(({ name }) => name !== 'loading' && name !== 'empty')) {
  for (const viewport of [mobile, desktop]) {
    test(`repositories: ${state.name}: focus ring and tab order at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      // The last visual page keeps the list short enough to tab to the pager.
      await openState(page, state, '/users/octocat?page=2')

      const visited = await tabThrough(page, 60)
      const labels = visited.map((element) => element.label)
      if (state.name === 'error') {
        expect(labels).toContain('button Tentar novamente')
      } else {
        expect(labels).toContain('select Estrelas — maior para menorEstrelas — menor para maiorNome — A a ZAtualização — mais recente')
        expect(labels).toContain('a repo-044')
        // "Próxima" is disabled on the last page, so "Anterior" is the pager's only stop.
        expect(labels.at(-1)).toBe('button Anterior')
      }
      expectFocusRing(visited)
      expectVisualTabOrder(visited)
    })
  }
}

test('follows rel=next through the browser: 3 API pages, 237 repositories', async ({ page }) => {
  const all = repositoriesOf('r', 237)
  all[236] = repositoryOf('star-of-page-3', { stargazers_count: 9999 })
  const requested: number[] = []
  const serve = pagedRepositories(all)
  await stubGitHub(page, undefined, (route, login, pageNumber) => {
    requested.push(pageNumber)
    return serve(route, login, pageNumber)
  })

  await page.goto('/users/octocat')

  await expect(section(page).getByText('Página 1 de 8')).toBeVisible()
  expect(requested).toEqual([1, 2, 3])
  await expect(section(page).getByRole('listitem')).toHaveCount(30)
  await expect(section(page).getByRole('listitem').first()).toContainText('star-of-page-3')
})

test('browser back from the detail restores sort and page without requests', async ({ page }) => {
  const users = await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  let repositoryRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/repos?')) repositoryRequests += 1
  })

  await page.goto('/users/octocat?sort=name-asc&page=2')
  await expect(section(page).getByText('Página 2 de 2')).toBeVisible()
  await section(page).getByRole('link', { name: 'r-031' }).click()
  await expect(page).toHaveURL('/users/octocat/repos/r-031')

  await page.goBack()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await expect(section(page).getByText('Página 2 de 2')).toBeVisible()
  await expect(section(page).getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('name-asc')
  await expect(section(page).getByRole('listitem').first()).toContainText('r-031')
  expect(users).toEqual(['octocat'])
  expect(repositoryRequests).toBe(1)
})
