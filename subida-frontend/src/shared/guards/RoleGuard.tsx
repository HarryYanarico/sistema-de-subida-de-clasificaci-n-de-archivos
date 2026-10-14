import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'

interface RoleGuardProps {
  children: ReactNode
  roles?: string[]
  redirectTo?: string
}

/**
 * Guarda que restringe el acceso a componentes o rutas según el rol asignado al usuario.
 */
export function RoleGuard({ children, roles, redirectTo = ROUTES.DASHBOARD }: RoleGuardProps) {
  const { tieneRol } = useAuth()

  if (roles && roles.length > 0 && !tieneRol(...roles)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
