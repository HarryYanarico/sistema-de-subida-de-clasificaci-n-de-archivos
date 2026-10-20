import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { RevisionDudosasPage } from '../pages/RevisionDudosasPage'
import { RevisionSinClasificarPage } from '../pages/RevisionSinClasificarPage'
import { RevisionDuplicadosPage } from '../pages/RevisionDuplicadosPage'
import { RevisionSinAgruparPage } from '../pages/RevisionSinAgruparPage'

export const revisionRoutes: RouteDefinition[] = [
  {
    path: ROUTES.REVISION.DUDOSAS,
    element: <RevisionDudosasPage />,
    roles: ['admin', 'operador'],
  },
  {
    path: ROUTES.REVISION.SIN_CLASIFICAR,
    element: <RevisionSinClasificarPage />,
    roles: ['admin', 'operador'],
  },
  {
    path: ROUTES.REVISION.DUPLICADOS,
    element: <RevisionDuplicadosPage />,
    roles: ['admin', 'operador'],
  },
  {
    path: ROUTES.REVISION.SIN_AGRUPAR,
    element: <RevisionSinAgruparPage />,
    roles: ['admin', 'operador'],
  },
]
