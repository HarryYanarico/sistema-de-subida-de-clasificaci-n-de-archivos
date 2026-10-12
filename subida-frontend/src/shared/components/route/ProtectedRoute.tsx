import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  /** Si se indica, el usuario debe tener alguno de estos roles. */
  roles?: string[]
}

/**
 * Guarda de ruta por sesion y, opcionalmente, por rol.
 *
 * Es una guarda de navegacion, NO de seguridad: el backend no valida el token
 * (ver la nota de seguridad en `apps/documentos/schema.py`). Evita que un
 * usuario sin sesion vea pantallas vacias, pero no impide que llame a la API
 * directamente.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, tieneRol } = useAuth()
  const location = useLocation()

  // Sin este corte, la primera renderizacioniria con `user` todavia sin leer y
  // redirigiria al login a un usuario que si tiene sesion.
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>
  }

  if (!isAuthenticated) {
    // `state.from` permite devolver al usuario a donde estaba tras loguearse.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !tieneRol(...roles)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
