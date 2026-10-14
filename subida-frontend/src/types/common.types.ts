/**
 * Tipos comunes, utilitarios y de autenticación transversal.
 */

export type Rol = 'admin' | 'operador'

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: Rol
  telefono: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  search?: string
  orderBy?: string
}

export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
