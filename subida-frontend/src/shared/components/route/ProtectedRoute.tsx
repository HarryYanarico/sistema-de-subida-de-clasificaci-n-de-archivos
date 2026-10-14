import { ReactNode } from 'react'
import { AuthGuard, RoleGuard } from '../../guards'

interface ProtectedRouteProps {
  children: ReactNode
  /** Si se indica, el usuario debe tener alguno de estos roles. */
  roles?: string[]
}

/**
 * Guarda combinada para rutas que requieren sesión activa y opcionalmente rol específico.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  return (
    <AuthGuard>
      <RoleGuard roles={roles}>
        {children}
      </RoleGuard>
    </AuthGuard>
  )
}
