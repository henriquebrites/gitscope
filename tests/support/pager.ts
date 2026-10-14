import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The repositories pager shows page `current` of `total`: below 640px as the compact "p de N",
 * from 640px as the numbered button marked `aria-current="page"`.
 */
export async function expectPage(page: Page, section: Locator, current: number, total: number) {
  const compact = (page.viewportSize()?.width ?? 1280) < 640
  if (compact) {
    await expect(section.getByTestId('pager-compact')).toHaveText(`${current} de ${total}`)
  } else {
    const button = section.getByRole('button', { name: `Página ${current}`, exact: true })
    await expect(button).toBeVisible()
    await expect(button).toHaveAttribute('aria-current', 'page')
  }
}

/** The sort pill currently checked. */
export function sortPill(section: Locator, name: string) {
  return section.getByRole('radiogroup', { name: 'Ordenar por' }).getByRole('radio', { name, exact: true })
}
