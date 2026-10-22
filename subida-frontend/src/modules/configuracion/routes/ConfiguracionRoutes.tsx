import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { TiposDocumentoPage } from '../pages/TiposDocumentoPage'

export const configuracionRoutes: RouteDefinition[] = [
  {
    path: ROUTES.CONFIGURACION.TIPOS_DOCUMENTO,
    element: <TiposDocumentoPage />,
    roles: ['admin'],
  },
]
