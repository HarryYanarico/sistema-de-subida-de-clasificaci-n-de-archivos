export interface Unidad {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  activo: boolean;
}

export interface Persona {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  ci: string;
  email?: string;
  telefono?: string;
  totalDocumentos: number;
  documentosClasificados: number;
  porcentajeCompletado: number;
  tieneDocumentosClasificados?: boolean;
  createdAt: string;
}

export interface TipoDocumento {
  id: number;
  nombre: string;
  slug: string;
  palabrasClave: string;
  activo: boolean;
}

export interface Documento {
  id: number;
  persona: Persona;
  tipoDocumento?: TipoDocumento;
  archivoOriginal: string;
  paginaNumero: number;
  textoExtraido: string;
  estado: 'clasificado' | 'pendiente' | 'verificado';
  createdAt: string;
}

export interface PersonaConnection {
  items: Persona[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DocumentoByPersona {
  personaId: number;
  documentos: Documento[];
  totalPaginas: number;
  clasificados: number;
  pendientes: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'operador';
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}
