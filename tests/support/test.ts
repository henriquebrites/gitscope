import { expect, test as base } from '@playwright/test'

const localHosts = new Set(['localhost', '127.0.0.1'])

/**
 * Every spec imports `test` from here. The context route is the fallback: page routes
 * registered by the stubs take precedence, so only a request no stub answered reaches it.
 * Such a request is aborted, so nothing leaves the machine, and fails the test.
 */
export const test = base.extend<{ networkGuard: void }>({
  networkGuard: [
    async ({ context }, use) => {
      const unrouted: string[] = []
      await context.route('**/*', (route) => {
        const url = route.request().url()
        if (localHosts.has(new URL(url).hostname)) return route.continue()
        unrouted.push(url)
        return route.abort('blockedbyclient')
      })
      await use()
      expect(unrouted, 'requests that no page.route intercepted').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
