import { languageColor } from '../../utils/languageColor'

/** The language's colour dot and name; a language outside the colour map gets a neutral dot. */
function LanguageDot({ language }: { language: string }) {
  const color = languageColor(language)

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        data-testid="language-dot"
        // The hairline ring keeps a dark dot visible on the dark theme.
        className={`size-2 shrink-0 rounded-full ring-1 ring-hairline ${color ? '' : 'bg-mute'}`}
        style={color ? { backgroundColor: color } : undefined}
      />
      {language}
    </span>
  )
}

export default LanguageDot
