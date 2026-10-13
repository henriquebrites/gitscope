/** Every class name used by the container and its descendants. */
export function usedClasses(container: HTMLElement): string[] {
  return [container, ...container.querySelectorAll('*')].flatMap((element) => [
    ...element.classList,
  ])
}

// Token checks compare the utility itself, so responsive and state variants are dropped.
export function withoutVariants(classes: string[]): string[] {
  return classes.map((name) => name.replace(/^(?:[^[\]():]+:)+/, ''))
}

export function usesToken(classes: string[], prefixes: string[], tokens: string[]): boolean {
  return classes.some((name) =>
    prefixes.some((prefix) => tokens.some((token) => name === `${prefix}-${token}`)),
  )
}
