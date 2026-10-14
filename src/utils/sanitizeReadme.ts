import DOMPurify from 'dompurify'

// An instance of our own, so the link hook below never applies to any other use of DOMPurify.
const purify = DOMPurify(window)

// Links that leave the app open in a new tab, without access to this window.
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  const href = node.getAttribute('href') ?? ''
  if (/^https?:/i.test(href)) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  } else {
    node.removeAttribute('target')
  }
})

/**
 * README HTML from GitHub, made safe for the DOM. DOMPurify already drops scripts, iframes and
 * event handlers (`on*`); styles and forms go too, so the README neither restyles the page
 * nor collects input, and its look comes only from the theme tokens.
 */
export function sanitizeReadme(html: string): string {
  return purify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  })
}
