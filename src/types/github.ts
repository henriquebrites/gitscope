/** Public profile returned by `GET /users/{username}` (PRD §10). */
export interface Profile {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  email: string | null
  followers: number
  following: number
  public_repos: number
}

/** Public repository returned by `GET /users/{username}/repos` (PRD §10). */
export interface Repository {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  updated_at: string
}
