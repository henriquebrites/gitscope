import { compile } from 'tailwindcss'
import tailwindCss from 'tailwindcss/index.css?raw'
import projectCss from '../index.css?raw'

// DESIGN.md spacing steps on the 4px base: xxs 1, xs 2, sm 3, md 4, lg 6, xl 8, 2xl 10,
// 3xl 16, 4xl 24, section 32. Zero resets spacing and is allowed too.
export const allowedSpacingFactors = new Set([0, 1, 2, 3, 4, 6, 8, 10, 16, 24, 32])

// The last value segment: an arbitrary value or `px` after `-`, or an arbitrary modifier
// after `/`, optionally followed by the important flag (`p-[13px]!`).
const offScaleValue = /(-|\/)(\[[^\]]*\]|\([^)]*\)|px)(!?)$/

// The project stylesheet without its base layer, so each build holds only the candidate's
// rules (custom @utility definitions included); classes the base layer applies are checked
// as candidates (see appliedClasses).
const candidateCss = projectCss.replace(/@layer base\s*{[\s\S]*?\n}/, '')

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(candidateCss, {
    loadStylesheet: async (id, base) => {
      if (id !== 'tailwindcss') throw new Error(`Unexpected stylesheet: ${id}`)
      return { path: id, base, content: tailwindCss }
    },
  })
  return compiler.build(candidates)
}

function spacingFactors(css: string): number[] {
  // Tailwind writes factor 1 as a bare var(--spacing).
  return [...css.matchAll(/var\(--spacing\)(?:\s*\*\s*(-?[\d.]+))?/g)].map(([, n]) =>
    Math.abs(Number(n ?? 1)),
  )
}

/**
 * Asks Tailwind which classes are sized by --spacing. `offScale` holds the ones off the
 * DESIGN.md scale: a factor outside the allowed steps, or an arbitrary/`px` value on a
 * spacing utility.
 */
export async function spacingReport(
  classes: string[],
): Promise<{ spacing: string[]; offScale: string[] }> {
  if (spacingFactors(await build([])).length > 0) {
    throw new Error('Tailwind base output uses --spacing; spacing checks would be ambiguous')
  }
  const spacing: string[] = []
  const offScale: string[] = []

  for (const name of new Set(classes)) {
    const factors = spacingFactors(await build([name]))
    if (factors.length > 0) {
      spacing.push(name)
      if (factors.some((factor) => !allowedSpacingFactors.has(factor))) offScale.push(name)
    } else if (offScaleValue.test(name)) {
      const probe = spacingFactors(
        await build([name.replace(offScaleValue, (_, separator, _value, important) => `${separator}2${important}`)]),
      )
      if (probe.length > 0) {
        spacing.push(name)
        offScale.push(name)
      }
    }
  }
  return { spacing, offScale }
}
