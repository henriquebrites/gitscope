// GitHub Linguist colours of the most common languages, the same in both themes.
const linguistColors: Record<string, string> = {
  C: '#555555',
  'C#': '#178600',
  'C++': '#f34b7d',
  CSS: '#663399',
  Dart: '#00b4ab',
  Dockerfile: '#384d54',
  Elixir: '#6e4a7e',
  Go: '#00add8',
  HTML: '#e34c26',
  Haskell: '#5e5086',
  Java: '#b07219',
  JavaScript: '#f1e05a',
  'Jupyter Notebook': '#da5b0b',
  Kotlin: '#a97bff',
  Lua: '#000080',
  Makefile: '#427819',
  'Objective-C': '#438eff',
  PHP: '#4f5d95',
  Perl: '#0298c3',
  Python: '#3572a5',
  R: '#198ce7',
  Ruby: '#701516',
  Rust: '#dea584',
  SCSS: '#c6538c',
  Scala: '#c22d40',
  Shell: '#89e051',
  Swift: '#f05138',
  TypeScript: '#3178c6',
  Vue: '#41b883',
}

/** The language's Linguist colour, or `null` when it is not in the map (a neutral dot). */
export function languageColor(language: string): string | null {
  return Object.hasOwn(linguistColors, language) ? linguistColors[language] : null
}
