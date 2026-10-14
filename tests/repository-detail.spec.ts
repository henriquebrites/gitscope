import type { Page } from '@playwright/test'
import { expect, test } from './support/test.js'
import { expectPage } from './support/pager.js'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'
import {
  html,
  json,
  pagedRepositories,
  repositoriesOf,
  repositoryOf,
  stubGitHub,
  stubReadme,
  stubRepository,
  type RepositoryHandler,
} from './support/github.js'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

// No spaces or hyphens: only `break-words` can keep these inside 320 px.
const longName = 'repositorio'.repeat(10)
const longText = 'descricao'.repeat(35)

interface DetailState {
  name: string
  handler: RepositoryHandler
  /** Heading that tells the state has rendered. */
  heading: string
}

const states: DetailState[] = [
  {
    name: 'long name and description',
    handler: (route) => json(route, repositoryOf(longName, { description: longText })),
    heading: longName,
  },
  {
    name: 'null description and language',
    handler: (route) => json(route, repositoryOf('sem-dados', { description: null, language: null })),
    heading: 'sem-dados',
  },
  {
    name: 'not-found',
    handler: (route) => json(route, { message: 'Not Found' }, 404),
    heading: 'Repositório não encontrado',
  },
  {
    name: 'network',
    handler: (route) => route.abort('internetdisconnected'),
    heading: 'Sem conexão',
  },
  {
    name: 'rate-limited',
    handler: (route) =>
      json(route, { message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600),
      }),
    heading: 'Limite de consultas atingido',
  },
  {
    name: 'unexpected',
    handler: (route) => json(route, { message: 'Server Error' }, 500),
    heading: 'Algo deu errado',
  },
]

async function openState(page: Page, state: DetailState) {
  await stubGitHub(page)
  await stubRepository(page, state.handler)
  await page.goto(`/users/octocat/repos/${longName}`)
  await expect(
    page.getByRole('region', { name: 'Repositório' }).getByRole('heading', { level: 1, name: state.heading }),
  ).toBeVisible()
}

async function scrollWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth)
}

for (const state of states) {
  test.describe(`detail: ${state.name}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await openState(page, state)

      expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
    })

    for (const viewport of [mobile, desktop]) {
      test(`focus ring and tab order at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await openState(page, state)

        const visited = await tabThrough(page)
        expect(visited.map((element) => element.label)).toContain('a ← Voltar aos repositórios')
        expectFocusRing(visited)
        expectVisualTabOrder(visited)
      })
    }
  })
}

test('loading: no horizontal scroll at 320, skeleton in the detail area', async ({ page }) => {
  await page.setViewportSize(mobile)
  await stubGitHub(page)
  await stubRepository(page, () => new Promise<void>(() => {}))
  await page.goto(`/users/octocat/repos/${longName}`)

  const area = page.getByRole('region', { name: 'Repositório' })
  await expect(area.getByTestId('repository-skeleton')).toBeVisible()
  await expect(area.locator('[aria-live="polite"]')).toHaveText('Carregando repositório…')
  expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
})

test('refresh refetches the repository: the cache lives only in memory', async ({ page }) => {
  await stubGitHub(page)
  const repositories = await stubRepository(page)

  await page.goto('/users/octocat/repos/Hello-World')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
  expect(repositories).toEqual(['octocat/Hello-World'])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
  expect(repositories).toEqual(['octocat/Hello-World', 'octocat/Hello-World'])
})

test('from the list: no repository request, and back to the same sort and page', async ({ page }) => {
  const users = await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  const repositories = await stubRepository(page)

  await page.goto('/users/octocat?sort=name-asc&page=2')
  const list = page.getByRole('region', { name: 'Repositórios' })
  await expectPage(page, list, 2, 2)
  await list.getByRole('link', { name: 'r-031' }).click()

  await expect(page).toHaveURL('/users/octocat/repos/r-031')
  await expect(page.getByRole('heading', { level: 1, name: 'r-031' })).toBeVisible()
  expect(repositories).toEqual([])

  await page.getByRole('link', { name: 'Voltar aos repositórios' }).click()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await expectPage(page, list, 2, 2)
  expect(repositories).toEqual([])
  expect(users).toEqual(['octocat'])
})

test.describe('readme', () => {
  const readmeRegion = (page: Page) => page.getByRole('region', { name: 'README' })
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  )

  test('wide readme blocks scroll inside at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 })
    const longLine = `npx create-something --with-a-very-long-flag=${'x'.repeat(120)}`
    const columns = Array.from({ length: 8 }, (_, index) => `<th>Coluna-numero-${index + 1}</th>`).join('')
    await stubGitHub(page)
    await stubReadme(page, (route) =>
      html(
        route,
        `<h2>Instalação</h2><pre><code>${longLine}</code></pre><table><thead><tr>${columns}</tr></thead><tbody><tr>${columns.replaceAll('th>', 'td>')}</tr></tbody></table>`,
      ),
    )
    await page.goto('/users/octocat/repos/Hello-World')
    await expect(readmeRegion(page).getByRole('heading', { name: 'Instalação' })).toBeVisible()

    for (const selector of ['pre', 'table']) {
      const block = readmeRegion(page).locator(selector)
      await expect(block).toBeVisible()
      const { scrollWidth, clientWidth } = await block.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))
      // Wider than its box, so it scrolls inside it.
      expect(scrollWidth, selector).toBeGreaterThan(clientWidth)
      const box = (await block.boundingBox())!
      expect(box.x + box.width, selector).toBeLessThanOrEqual(320)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })

  test('hostile readme runs nothing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await stubGitHub(page)
    // The relative image resolves against the repository on GitHub; a 404 keeps it broken.
    await page.route('https://github.com/**', (route) => route.fulfill({ status: 404 }))
    await stubReadme(page, (route) =>
      html(
        route,
        `<p id="ok">Conteúdo seguro</p>
<script>window.pwned = 'script'</script>
<img src="nope.png" alt="quebrada" onerror="window.pwned = 'onerror'">
<svg><circle r="4" onload="window.pwned = 'svg'"></circle></svg>
<iframe src="https://evil.example/frame"></iframe>
<form action="https://evil.example/collect"><input name="q"></form>
<style>body { display: none }</style>
<a href="javascript:window.pwned = 'href'">clique</a>`,
      ),
    )
    await page.goto('/users/octocat/repos/Hello-World')
    await expect(readmeRegion(page).getByText('Conteúdo seguro')).toBeVisible()
    // Let a broken image fire its error event, if a handler had survived.
    await expect(readmeRegion(page).getByRole('img', { name: 'quebrada' })).toHaveJSProperty('complete', true)
    // The javascript: URL is gone, so the anchor is not even a link any more.
    const anchor = readmeRegion(page).getByText('clique')
    await expect(anchor).toBeVisible()
    expect((await anchor.getAttribute('href')) ?? '').not.toMatch(/javascript:/i)
    await anchor.click()

    expect(await page.evaluate(() => (window as unknown as { pwned?: string }).pwned)).toBeUndefined()
    const content = readmeRegion(page).getByTestId('readme-content')
    for (const selector of ['script', 'iframe', 'form', 'input', 'style']) {
      await expect(content.locator(selector), selector).toHaveCount(0)
    }
    const handlers = await content.evaluate((element) =>
      [...element.querySelectorAll('*')].flatMap((node) =>
        [...node.attributes].map((attribute) => attribute.name).filter((name) => name.startsWith('on')),
      ),
    )
    expect(handlers).toEqual([])
    await expect(page.locator('body')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('readme images load from their stubbed hosts', async ({ page }) => {
    const images: string[] = []
    await stubGitHub(page)
    for (const host of ['camo.githubusercontent.com', 'raw.githubusercontent.com']) {
      await page.route(`https://${host}/**`, (route) => {
        images.push(route.request().url())
        return route.fulfill({ status: 200, contentType: 'image/png', body: pixel })
      })
    }
    await stubReadme(page, (route) =>
      html(
        route,
        '<p><img src="https://camo.githubusercontent.com/abc/def" alt="badge"><img src="https://raw.githubusercontent.com/octocat/Hello-World/main/logo.png" alt="logo"></p>',
      ),
    )
    await page.goto('/users/octocat/repos/Hello-World')

    for (const name of ['badge', 'logo']) {
      const image = readmeRegion(page).getByRole('img', { name })
      await expect(image).toHaveJSProperty('complete', true)
      expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1)
    }
    expect(images).toHaveLength(2)
  })
})
