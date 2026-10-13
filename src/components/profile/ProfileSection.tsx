import type { ProfileResult } from '../../hooks/useProfile'
import ProfileCard from './ProfileCard'
import ProfileError from './ProfileError'
import ProfileSkeleton from './ProfileSkeleton'

interface ProfileSectionProps {
  result: ProfileResult
  login: string
  onRetry: () => void
}

function ProfileSection({ result, login, onRetry }: ProfileSectionProps) {
  return (
    <section aria-label="Perfil" className="flex flex-col gap-6">
      {/* Always mounted, so screen readers announce the change into loading. */}
      <p aria-live="polite" className="sr-only text-body-md text-body">
        {result.status === 'loading' ? 'Carregando perfil…' : ''}
      </p>
      {result.status === 'loading' && <ProfileSkeleton />}
      {result.status === 'success' && <ProfileCard profile={result.profile} />}
      {result.status === 'error' && (
        <ProfileError error={result.error} login={login} onRetry={onRetry} />
      )}
    </section>
  )
}

export default ProfileSection
