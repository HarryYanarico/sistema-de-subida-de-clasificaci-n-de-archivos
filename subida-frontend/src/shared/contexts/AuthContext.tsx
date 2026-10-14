import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { STORAGE_KEYS } from '@config/constants'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** `true` mientras lee localStorage, para no redirigir antes de saber. */
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  /** `true` si el usuario tiene alguno de los roles indicados. */
  tieneRol: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = STORAGE_KEYS.TOKEN
const USER_KEY = STORAGE_KEYS.USER

function leerSesion(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const userRaw = localStorage.getItem(USER_KEY)
    // Si falta uno de los dos, la sesion esta a medias y se trata como
    // ausente: dejarla "funcionando" dejaria la UI con un usuario sin token.
    if (!token || !userRaw) return { token: null, user: null }
    return { token, user: JSON.parse(userRaw) as User }
  } catch {
    // localStorage puede lanzar si el JSON esta corrupto o si el navegador
    // bloquea el almacenamiento. En ambos casos: sesion no disponible.
    return { token: null, user: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState(leerSesion)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSesion(leerSesion())
    setLoading(false)
  }, [])

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setSesion({ token, user })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setSesion({ token: null, user: null })
  }, [])

  const tieneRol = useCallback(
    (...roles: string[]) => !!sesion.user && roles.includes(sesion.user.role),
    [sesion.user]
  )

  return (
    <AuthContext.Provider
      value={{
        user: sesion.user,
        token: sesion.token,
        isAuthenticated: !!sesion.token && !!sesion.user,
        loading,
        login,
        logout,
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
