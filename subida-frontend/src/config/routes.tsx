import { ReactNode } from 'react'
import { Login } from '../modules/auth/pages/Login'
import { Dashboard } from '../modules/auth/pages/Dashboard'
import { ListaPersonas } from '../modules/personas/pages/ListaPersonas'
import { RegistrarPersona } from '../modules/personas/pages/RegistrarPersona'
import { CasilleroDocumentos } from '../modules/personas/pages/CasilleroDocumentos'
import { VistaPersonaLista } from '../modules/personas/pages/VistaPersonaLista'
import { VistaPersonaDocumentos } from '../modules/personas/pages/VistaPersonaDocumentos'
import { SubirDocumentos } from '../modules/documentos/pages/SubirDocumentos'
import { DocumentosPendientes } from '../modules/documentos/pages/DocumentosPendientes'
import { RevisionDudosas } from '../modules/revision/pages/RevisionDudosas'
import { RevisionSinClasificar } from '../modules/revision/pages/RevisionSinClasificar'
import { RevisionDuplicados } from '../modules/revision/pages/RevisionDuplicados'
import { TiposDocumento } from '../modules/configuracion/pages/TiposDocumento'

export interface AppRoute {
  path: string
  element: ReactNode
  /** Ruta accesible sin sesion. Solo /login hoy. */
  publico?: boolean
  /** Roles con acceso. Si se omite, basta con tener sesion. */
  roles?: string[]
}

export const routes: AppRoute[] = [
  { path: '/login', element: <Login />, publico: true },
  { path: '/', element: <Dashboard /> },
  { path: '/personas', element: <ListaPersonas /> },
  { path: '/personas/registrar', element: <RegistrarPersona /> },
  { path: '/personas/:id/casillero', element: <CasilleroDocumentos /> },
  { path: '/vista-persona', element: <VistaPersonaLista /> },
  { path: '/vista-persona/:id', element: <VistaPersonaDocumentos /> },
  { path: '/documentos/subir', element: <SubirDocumentos /> },
  { path: '/documentos/pendientes', element: <DocumentosPendientes /> },
  // Colas de revision (Fases 5 y 6). Requieren rol: revisar implica decidir
  // sobre datos de otras personas, no solo leerlos.
  { path: '/revision/dudosas', element: <RevisionDudosas />, roles: ['admin', 'operador'] },
  { path: '/revision/sin-clasificar', element: <RevisionSinClasificar />, roles: ['admin', 'operador'] },
  { path: '/revision/duplicados', element: <RevisionDuplicados />, roles: ['admin', 'operador'] },
  { path: '/configuracion/tipos-documento', element: <TiposDocumento /> },
]
