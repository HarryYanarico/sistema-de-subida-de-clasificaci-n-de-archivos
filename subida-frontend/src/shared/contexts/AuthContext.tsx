import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { apolloClient } from '@graphql/client'
import { ME_QUERY } from '@graphql/queries/auth.queries'
import { env } from '@config/environment'
import { User, Rol } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** `true` mientras verifica la sesión con el backend, para no redirigir antes de saber. */
  loading: boolean
  login: (token?: string, user?: User) => void
  logout: () => void
  refetchUser: () => Promise<void>
  /** `true` si el usuario tiene alguno de los roles indicados. */
  tieneRol: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const cargarUsuario = useCallback(async () => {
    try {
      const { data } = await apolloClient.query({
        query: ME_QUERY,
        fetchPolicy: 'network-only',
      })
      if (data?.me) {
        const raw = data.me
        setUser({
          id: raw.id,
          username: raw.username,
          email: raw.email,
          first_name: raw.firstName,
          last_name: raw.lastName,
          role: raw.role as Rol,
          rolSlug: raw.rolSlug,
          codEmpleado: raw.codEmpleado,
          telefono: raw.telefono || '',
          unidad: raw.unidad,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarUsuario()
  }, [cargarUsuario])

  const login = useCallback(
    (_token?: string, userNuevo?: User) => {
      if (userNuevo) {
        setUser(userNuevo)
      }
      cargarUsuario()
    },
    [cargarUsuario]
  )

  const logout = useCallback(() => {
    apolloClient.clearStore().catch(() => {})
    setUser(null)
    const loginUrl = env.admincentralLoginUrl || '/login'
    if (loginUrl.startsWith('http://') || loginUrl.startsWith('https://')) {
      window.location.href = loginUrl
    }
  }, [])

  const tieneRol = useCallback(
    (...roles: string[]) => {
      if (!user) return false
      return roles.includes(user.role) || (!!user.rolSlug && roles.includes(user.rolSlug))
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        refetchUser: cargarUsuario,
        tieneRol,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

