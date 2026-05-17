import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) {
    return <section className="card"><h2>Access denied</h2><p>You do not have permission for this area.</p></section>
  }
  return <>{children}</>
}
