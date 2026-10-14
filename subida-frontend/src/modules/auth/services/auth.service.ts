import { STORAGE_KEYS } from '@config/constants'
import { User } from '@app-types/index'

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN)
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

  setSession(token: string, user: User): void {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  },

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
  },

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser()
  },
}
