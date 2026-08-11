import { RouteObject } from 'react-router-dom';
import { Login } from '../modules/auth/pages/Login';
import { Dashboard } from '../modules/auth/pages/Dashboard';
import { ListaPersonas } from '../modules/personas/pages/ListaPersonas';
import { RegistrarPersona } from '../modules/personas/pages/RegistrarPersona';
import { CasilleroDocumentos } from '../modules/personas/pages/CasilleroDocumentos';
import { VistaPersonaLista } from '../modules/personas/pages/VistaPersonaLista';
import { VistaPersonaDocumentos } from '../modules/personas/pages/VistaPersonaDocumentos';
import { SubirDocumentos } from '../modules/documentos/pages/SubirDocumentos';
import { DocumentosPendientes } from '../modules/documentos/pages/DocumentosPendientes';
import { TiposDocumento } from '../modules/configuracion/pages/TiposDocumento';
import { Unidades } from '../modules/configuracion/pages/Unidades';

export const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  { path: '/', element: <Dashboard /> },
  { path: '/personas', element: <ListaPersonas /> },
  { path: '/personas/registrar', element: <RegistrarPersona /> },
  { path: '/personas/:id/casillero', element: <CasilleroDocumentos /> },
  { path: '/vista-persona', element: <VistaPersonaLista /> },
  { path: '/vista-persona/:id', element: <VistaPersonaDocumentos /> },
  { path: '/documentos/subir', element: <SubirDocumentos /> },
  { path: '/documentos/pendientes', element: <DocumentosPendientes /> },
  { path: '/configuracion/tipos-documento', element: <TiposDocumento /> },
  { path: '/configuracion/unidades', element: <Unidades /> },
];
