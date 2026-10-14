import { ReactNode } from 'react'
import { authRoutes } from '@modules/auth'
import { personasRoutes } from '@modules/personas'
import { documentosRoutes } from '@modules/documentos'
import { revisionRoutes } from '@modules/revision'
import { configuracionRoutes } from '@modules/configuracion'
import { RouteDefinition } from '@shared/types/shared.types'

export interface AppRoute {
  path: string
  element: ReactNode
  /** Ruta accesible sin sesión. Solo /login hoy. */
  publico?: boolean
  /** Roles con acceso. Si se omite, basta con tener sesión. */
  roles?: string[]
}

export type { RouteDefinition }

/**
 * Enrutador centralizado compuesto de las definiciones de ruta de cada módulo funcional.
 */
export const routes: AppRoute[] = [
  ...authRoutes,
  ...personasRoutes,
  ...documentosRoutes,
  ...revisionRoutes,
  ...configuracionRoutes,
]
