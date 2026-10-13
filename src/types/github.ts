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
