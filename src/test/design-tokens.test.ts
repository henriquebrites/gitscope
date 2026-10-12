import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { themeVariables, tokensOf, type TokenGroup } from './theme'

// Token names defined by DESIGN.md (getdesign, vercel). DESIGN.md is not versioned,
// so the names are pinned here.
const designTokens: Record<Exclude<TokenGroup, 'font'>, string[]> = {
  color: [
    'primary', 'on-primary', 'ink', 'body', 'mute', 'faint', 'hairline', 'hairline-soft',
    'canvas', 'canvas-elevated', 'link', 'link-deep', 'link-soft', 'error', 'error-deep',
    'warning', 'warning-soft', 'warning-deep', 'violet', 'violet-soft', 'cyan', 'cyan-soft',
    'pink', 'magenta', 'gradient-develop-start', 'gradient-develop-end',
    'gradient-preview-start', 'gradient-preview-end', 'gradient-ship-start', 'gradient-ship-end',
  ],
  text: [
    'display-xl', 'heading-lg', 'heading-md', 'label-sm', 'mono-eyebrow', 'body-lg',
    'body-md', 'body-sm', 'button-lg', 'button-md', 'code',
  ],
  spacing: ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'section'],
  radius: ['none', 'sm', 'md', 'lg', 'pill-category', 'pill', 'full'],
}

// Original DESIGN.md color values; any token declared with another value must be listed.
const designColors: Record<string, string> = {
  primary: '#171717', 'on-primary': '#ffffff', ink: '#171717', body: '#4d4d4d',
  mute: '#8f8f8f', faint: '#a1a1a1', hairline: '#ebebeb', 'hairline-soft': '#f2f2f2',
  canvas: '#fafafa', 'canvas-elevated': '#ffffff', link: '#0070f3', 'link-deep': '#0761d1',
  'link-soft': '#d3e5ff', error: '#ee0000', 'error-deep': '#c50000', warning: '#f5a623',
  'warning-soft': '#ffefcf', 'warning-deep': '#ab570a', violet: '#7928ca',
  'violet-soft': '#d8ccf1', cyan: '#50e3c2', 'cyan-soft': '#aaffec', pink: '#ff0080',
  magenta: '#eb367f', 'gradient-develop-start': '#007cf0', 'gradient-develop-end': '#00dfd8',
  'gradient-preview-start': '#7928ca', 'gradient-preview-end': '#ff0080',
  'gradient-ship-start': '#ff4d4d', 'gradient-ship-end': '#f9cb28',
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(color(foreground)), luminance(color(background))].sort(
    (a, b) => b - a,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

function color(token: string): string {
  const value = themeVariables.get(`color-${token}`)
  if (!value?.match(/^#[0-9a-f]{6}$/i)) throw new Error(`color-${token} is not a 6-digit hex`)
  return value
}

const textTokens = ['ink', 'body', 'mute', 'faint', 'link', 'link-deep', 'error', 'error-deep', 'warning-deep']
const textSurfaces = ['canvas', 'canvas-elevated', 'hairline-soft']

describe('design tokens', () => {
  it('declares every token group', () => {
    for (const [group, names] of Object.entries(designTokens)) {
      expect(tokensOf(group as TokenGroup), group).toEqual(expect.arrayContaining(names))
    }
    expect(themeVariables.get('font-sans')).toMatch(/^'Geist Variable'/)
    expect(themeVariables.get('font-mono')).toMatch(/^'Geist Mono Variable'/)
  })

  it.each(textTokens.flatMap((text) => textSurfaces.map((surface) => [text, surface])))(
    'contrast: text %s on %s is at least 4.5:1',
    (text, surface) => {
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('contrast: on-primary on primary is at least 4.5:1', () => {
    expect(contrast('on-primary', 'primary')).toBeGreaterThanOrEqual(4.5)
  })

  it('lists every adjusted token for the README', () => {
    const listed = new Map(
      [...css.matchAll(/^ \*\s+([a-z-]+)\s+(#[0-9a-f]{6}) -> (#[0-9a-f]{6})/gm)].map(
        ([, name, from, to]) => [name, [from, to]],
      ),
    )
    const adjusted = Object.entries(designColors)
      .filter(([name, original]) => color(name) !== original)
      .map(([name, original]) => [name, [original, color(name)]])

    expect(adjusted.length).toBeGreaterThan(0)
    expect(listed).toEqual(new Map(adjusted as [string, string[]][]))
  })

  it.each(textSurfaces)('contrast: focus ring on %s is at least 3:1', (surface) => {
    expect(contrast('focus', surface)).toBeGreaterThanOrEqual(3)
  })
})
