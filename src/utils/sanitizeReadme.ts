import DOMPurify from 'dompurify'

// An instance of our own, so the hooks below never apply to any other use of DOMPurify.
const purify = DOMPurify(window)

// Repository of the README being sanitized; set only for the duration of `sanitizeReadme`.
let repositoryUrl = ''

// A scheme (`https:`, `mailto:`), a protocol-relative URL or an in-page anchor.
const notRelative = /^([a-z][a-z\d+.-]*:|\/\/|#)/i

// GitHub keeps README URLs relative to the repository; resolved here, they never hit the app.
function resolve(url: string, kind: 'blob' | 'raw'): string {
  if (notRelative.test(url)) return url
  return new URL(url.replace(/^\/+/, ''), `${repositoryUrl}/${kind}/HEAD/`).href
}

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG' && node.hasAttribute('src')) {
    node.setAttribute('src', resolve(node.getAttribute('src') ?? '', 'raw'))
  }
  if (node.tagName !== 'A') return
  // Links that leave the app open in a new tab, without access to this window.
  const href = resolve(node.getAttribute('href') ?? '', 'blob')
  if (node.hasAttribute('href')) node.setAttribute('href', href)
  if (/^https?:/i.test(href)) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  } else {
    node.removeAttribute('target')
  }
})

/**
 * README HTML of `owner/repo` from GitHub, made safe for the DOM. DOMPurify already drops
 * scripts, iframes and event handlers (`on*`); styles and forms go too, so the README neither
 * restyles the page nor collects input, and its look comes only from the theme tokens.
 */
export function sanitizeReadme(html: string, owner: string, repo: string): string {
  repositoryUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  return purify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  })
}
