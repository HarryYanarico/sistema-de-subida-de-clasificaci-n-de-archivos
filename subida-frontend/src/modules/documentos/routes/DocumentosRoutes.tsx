import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { SubirDocumentosPage } from '../pages/SubirDocumentosPage'
import { DocumentosPendientesPage } from '../pages/DocumentosPendientesPage'
import { AgruparLotePage } from '../pages/AgruparLotePage'
import { LoteDetallePage } from '../pages/LoteDetallePage'
import { LoteRevisionPage } from '../pages/LoteRevisionPage'

export const documentosRoutes: RouteDefinition[] = [
  {
    path: ROUTES.DOCUMENTOS.SUBIR,
    element: <SubirDocumentosPage />,
  },
  {
    path: ROUTES.DOCUMENTOS.PENDIENTES,
    element: <DocumentosPendientesPage />,
  },
  {
    path: ROUTES.LOTES.AGRUPAR(),
    element: <AgruparLotePage />,
  },
  {
    path: '/lotes/:loteId/agrupar',
    element: <AgruparLotePage />,
  },
  {
    path: ROUTES.LOTES.DETALLE(),
    element: <LoteDetallePage />,
  },
  {
    path: ROUTES.LOTES.REVISION(),
    element: <LoteRevisionPage />,
  },
]
