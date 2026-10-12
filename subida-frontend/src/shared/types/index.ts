export type Rol = 'admin' | 'operador';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Rol;
  telefono: string;
}

export interface Persona {
  id: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  ci: string;
  email: string;
  telefono: string;
  created_at: string;
  updated_at: string;
  total_documentos?: number;
  documentos_clasificados?: number;
  porcentaje_completado?: number;
  tiene_documentos_clasificados?: boolean;
}

export interface TipoDocumento {
  id: number;
  nombre: string;
  slug: string;
  palabras_clave: string;
  keywords_obligatorias: string[];
  activo: boolean;
  created_at: string;
}

export type EstadoDocumento =
  | 'clasificado'
  | 'dudosa'
  | 'duplicado'
  | 'pendiente'
  | 'sin_clasificar'
  | 'verificado';

/** Una correccion humana, tal como quedo registrada en el backend. */
export interface EntradaHistorial {
  fecha: string;
  usuario: string | null;
  estado_anterior: EstadoDocumento | string;
  tipo_anterior: string | null;
  tipo_nuevo: string | null;
  score_anterior: number | null;
  keywords_anteriores: string[] | null;
}

export interface Documento {
  id: number;
  persona: Persona;
  tipo_documento: TipoDocumento | null;
  archivo_original: string;
  pagina_numero: number;
  texto_extraido: string;
  estado: EstadoDocumento;
  /** Puntaje del clasificador local. null si no se pudo clasificar. */
  score: number | null;
  /** Palabras clave que el clasificador local encontro en el texto. */
  keywords_matcheadas: string[];
  /** Correcciones humanas aplicadas a este documento, en orden. */
  historial_clasificacion: EntradaHistorial[];
  phash: string | null;
  /** Id del documento original, si esta pagina es una copia perceptual. */
  duplicado_de: string | null;
  created_at: string;
}

export interface PersonaConnection {
  items: Persona[];
  total: number;
  page: number;
  total_pages: number;
}

export interface DocumentoByPersona {
  persona_id: number;
  documentos: Documento[];
  total_paginas: number;
  clasificados: number;
  pendientes: number;
}
