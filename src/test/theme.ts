import css from '../index.css?raw'

export type TokenGroup = 'color' | 'font' | 'text' | 'spacing' | 'radius'

const themeBlock = css.match(/@theme\s*{([\s\S]*?)\n}/)?.[1] ?? ''

/** Theme variables declared in src/index.css, e.g. `color-ink` -> `#171717`. */
export const themeVariables: ReadonlyMap<string, string> = new Map(
  [...themeBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)]
    .filter(([, name]) => !name.includes('--') && name !== 'color-*')
    .map(([, name, value]) => [name, value.trim()]),
)

/** Token names of one group, without the namespace prefix (`color-ink` -> `ink`). */
export function tokensOf(group: TokenGroup): string[] {
  const prefix = `${group}-`
  return [...themeVariables.keys()]
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
}
