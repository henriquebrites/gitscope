import type { Page } from '@playwright/test'
import { expect, test } from './support/test.js'
import { expectPage, sortPill } from './support/pager.js'
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
    ready: (page) => section(page).getByRole('navigation', { name: 'Páginas de repositórios' }),
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
        // The sort group is one Tab stop in the main area: its checked radio.
        expect(visited.filter((element) => element.region === 'main' && element.label === 'input')).toHaveLength(1)
        expect(labels).toContain('a repo-044')
        // "Próxima" is disabled on the last page. Below 640px "Anterior" is the pager's only
        // stop; from 640px the numbers follow it, the current one last.
        expect(labels.at(-1)).toBe(viewport.width < 640 ? 'button Anterior' : 'button 2')
      }
      expectFocusRing(visited)
      expectVisualTabOrder(visited)
    })
  }
}

test('pager keeps the focus on an enabled button at the limits', async ({ page }) => {
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  await page.goto('/users/octocat')
  const next = section(page).getByRole('button', { name: 'Próxima' })
  const previous = section(page).getByRole('button', { name: 'Anterior' })

  await next.focus()
  await page.keyboard.press('Enter')
  await expectPage(page, section(page), 2, 2)
  await expect(previous).toBeFocused()

  await page.keyboard.press('Enter')
  await expectPage(page, section(page), 1, 2)
  await expect(next).toBeFocused()
})

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

  await expectPage(page, section(page), 1, 8)
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
  await expectPage(page, section(page), 2, 2)
  await section(page).getByRole('link', { name: 'r-031' }).click()
  await expect(page).toHaveURL('/users/octocat/repos/r-031')

  await page.goBack()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await expectPage(page, section(page), 2, 2)
  await expect(sortPill(section(page), 'Nome')).toBeChecked()
  await expect(section(page).getByRole('listitem').first()).toContainText('r-031')
  expect(users).toEqual(['octocat'])
  expect(repositoryRequests).toBe(1)
})

test.describe('grid columns', () => {
  // Uneven descriptions, so a card that did not stretch would be shorter than its neighbour.
  const uneven = repositoriesOf('g', 6).map((repository, index) => ({
    ...repository,
    description: index % 2 === 0 ? 'Curta.' : 'Uma descrição bem mais longa que ocupa várias linhas no card. '.repeat(3),
  }))

  async function cardBoxes(page: Page) {
    await stubGitHub(page, undefined, pagedRepositories(uneven))
    await page.goto('/users/octocat?sort=name-asc')
    const cards = section(page).getByRole('listitem')
    await expect(cards).toHaveCount(6)
    return Promise.all([0, 1, 2, 3, 4, 5].map(async (index) => (await cards.nth(index).boundingBox())!))
  }

  test('grid columns: two from 640px, same height on a row', async ({ page }) => {
    await page.setViewportSize(desktop)
    const boxes = await cardBoxes(page)

    for (let row = 0; row < 3; row += 1) {
      const [left, right] = [boxes[row * 2], boxes[row * 2 + 1]]
      expect(right.y).toBe(left.y)
      expect(right.x).toBeGreaterThan(left.x + left.width - 1)
      expect(right.height).toBe(left.height)
    }
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y)
  })

  test('grid columns: one below 640px', async ({ page }) => {
    await page.setViewportSize(mobile)
    const boxes = await cardBoxes(page)

    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].x).toBe(boxes[0].x)
      expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y)
    }
  })
})

test('compact pager at 320: Anterior, "p de N", Próxima', async ({ page }) => {
  await page.setViewportSize(mobile)
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 300)))
  await page.goto('/users/octocat?page=3')

  const pager = section(page).getByRole('navigation', { name: 'Páginas de repositórios' })
  await expect(pager.getByTestId('pager-compact')).toHaveText('3 de 10')
  await expect(pager.getByTestId('pager-numbers')).toBeHidden()
  const visible = await pager.evaluate((nav) =>
    [...nav.children].filter((child) => getComputedStyle(child).display !== 'none').map((child) => child.textContent),
  )
  expect(visible).toEqual(['Anterior', '3 de 10', 'Próxima'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('numbered pager from 640px: truncated numbers between the arrows', async ({ page }) => {
  await page.setViewportSize(desktop)
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 300)))
  await page.goto('/users/octocat?page=5')

  const pager = section(page).getByRole('navigation', { name: 'Páginas de repositórios' })
  await expect(pager.getByTestId('pager-compact')).toBeHidden()
  await expect(pager.getByTestId('pager-numbers')).toHaveText('1…456…10')
  await expect(pager.getByRole('button', { name: 'Página 5', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('focus stays on the page number, now current', async ({ page }) => {
  await page.setViewportSize(desktop)
  await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 300)))
  await page.goto('/users/octocat?sort=name-asc&page=5')

  const number = (n: number) => section(page).getByRole('button', { name: `Página ${n}`, exact: true })
  await number(6).focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=6')
  await expect(number(6)).toHaveAttribute('aria-current', 'page')
  await expect(number(6)).toBeFocused()

  // A jump that reshapes the numbers (to the last page) still keeps the focus on the target.
  await number(10).click()
  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=10')
  await expect(number(10)).toBeFocused()
  await expect(number(10)).toHaveAttribute('aria-current', 'page')
})
