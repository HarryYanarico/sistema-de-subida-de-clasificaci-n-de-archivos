import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { SubirDocumentosPage } from '../pages/SubirDocumentosPage'
import { DocumentosPendientesPage } from '../pages/DocumentosPendientesPage'

export const documentosRoutes: RouteDefinition[] = [
  {
    path: ROUTES.DOCUMENTOS.SUBIR,
    element: <SubirDocumentosPage />,
  },
  {
    path: ROUTES.DOCUMENTOS.PENDIENTES,
    element: <DocumentosPendientesPage />,
  },
]
