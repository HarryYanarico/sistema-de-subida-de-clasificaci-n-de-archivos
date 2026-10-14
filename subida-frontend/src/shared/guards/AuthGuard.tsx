import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Guarda que asegura que el usuario tenga una sesión activa.
 * Mientras se verifica el almacenamiento local, muestra un estado de carga para evitar parpadeos.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
