import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeReadme } from './sanitizeReadme'

function parse(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = sanitizeReadme(html)
  return container
}

afterEach(() => {
  delete (window as unknown as { pwned?: unknown }).pwned
  vi.useRealTimers()
})

describe('sanitizeReadme', () => {
  it.each([
    ['script', '<p>ok</p><script>window.pwned = 1</script>', 'script'],
    ['iframe', '<p>ok</p><iframe src="https://evil.example"></iframe>', 'iframe'],
    ['style', '<p>ok</p><style>body { display: none }</style>', 'style'],
    ['form', '<p>ok</p><form action="https://evil.example"><input name="q"><button>Go</button></form>', 'form, input, button'],
  ])('removes %s elements and keeps the content around them', (_name, html, selector) => {
    const container = parse(html)

    expect(container.querySelectorAll(selector)).toHaveLength(0)
    expect(container.querySelector('p')).toHaveTextContent('ok')
  })

  it('removes every on* attribute', () => {
    const container = parse(
      '<img src="x.png" alt="logo" onerror="window.pwned = 1"><a href="#a" onclick="window.pwned = 2" onmouseover="x()">a</a><div onload="y()">d</div>',
    )

    const attributes = [...container.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.name),
    )
    expect(attributes.filter((name) => name.startsWith('on'))).toEqual([])
    expect(container.querySelector('img')).toHaveAttribute('alt', 'logo')
  })

  it('removes inline style attributes and javascript: URLs', () => {
    const container = parse('<p style="color: red">x</p><a href="javascript:window.pwned = 3">bad</a>')

    expect(container.querySelector('p')).not.toHaveAttribute('style')
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
  })

  it('runs nothing from the README, even once it is in the DOM', async () => {
    vi.useFakeTimers()
    const container = parse(
      '<img src="x" onerror="window.pwned = 1"><script>window.pwned = 2</script><svg onload="window.pwned = 3"></svg>',
    )
    document.body.append(container)
    await vi.runAllTimersAsync()

    expect((window as unknown as { pwned?: unknown }).pwned).toBeUndefined()
    container.remove()
  })

  it('keeps the content a README is made of', () => {
    const container = parse(
      '<h1>T</h1><h2>S</h2><p>p <code>c</code></p><pre><code>block</code></pre><ul><li>i</li></ul><ol><li>j</li></ol><table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table><img src="https://example.com/a.png" alt="a">',
    )

    for (const selector of ['h1', 'h2', 'p', 'code', 'pre', 'ul', 'ol', 'li', 'table', 'th', 'td', 'img']) {
      expect(container.querySelector(selector), selector).not.toBeNull()
    }
  })

  describe('external links', () => {
    it.each(['https://github.com/octocat', 'http://example.com', 'HTTPS://EXAMPLE.COM/x'])(
      'external links: %s opens in a new tab with noopener',
      (href) => {
        const link = parse(`<a href="${href}" target="_self">x</a>`).querySelector('a')

        expect(link).toHaveAttribute('target', '_blank')
        expect(link?.getAttribute('rel')?.split(/\s+/)).toContain('noopener')
      },
    )

    it.each(['#section', '/docs/readme.md', 'mailto:a@b.c'])(
      'external links: %s is not an http(s) link and keeps the current tab',
      (href) => {
        const link = parse(`<a href="${href}" target="_blank">x</a>`).querySelector('a')

        expect(link).not.toHaveAttribute('target')
      },
    )
  })
})
