import { RouteDefinition } from '@shared/types/shared.types'
import { ROUTES } from '@config/routes'
import { ListaPersonasPage } from '../pages/ListaPersonasPage'
import { RegistrarPersonaPage } from '../pages/RegistrarPersonaPage'
import { CasilleroDocumentosPage } from '../pages/CasilleroDocumentosPage'
import { VistaPersonaListaPage } from '../pages/VistaPersonaListaPage'
import { VistaPersonaDocumentosPage } from '../pages/VistaPersonaDocumentosPage'

export const personasRoutes: RouteDefinition[] = [
  {
    path: ROUTES.PERSONAS.ROOT,
    element: <ListaPersonasPage />,
  },
  {
    path: ROUTES.PERSONAS.REGISTRAR,
    element: <RegistrarPersonaPage />,
  },
  {
    path: ROUTES.PERSONAS.CASILLERO(),
    element: <CasilleroDocumentosPage />,
  },
  {
    path: ROUTES.PERSONAS.VISTA_LISTA,
    element: <VistaPersonaListaPage />,
  },
  {
    path: ROUTES.PERSONAS.VISTA_DETALLE(),
    element: <VistaPersonaDocumentosPage />,
  },
]
