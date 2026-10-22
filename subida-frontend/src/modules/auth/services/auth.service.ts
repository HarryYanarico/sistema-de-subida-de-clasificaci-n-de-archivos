import { STORAGE_KEYS } from '@config/constants'
import { User } from '@app-types/index'

/**
 * Servicio de sesión de usuario en frontend.
 * Nota: El token JWT ya NO se almacena en localStorage; la sesión se mantiene exclusivamente
 * a través de la cookie HTTP-only (admincentral_access_token) emitida por admincentral.
 */
export const authService = {
  getToken(): string | null {
    // La sesión vive en la cookie HTTP-only del navegador
    return null
  },

  getUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },

  setSession(_token: string | null, user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  },

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.USER)
  },

  isAuthenticated(): boolean {
    return !!this.getUser()
  },
}
