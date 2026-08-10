export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'operador';
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
  unidad: Unidad;
  created_at: string;
  updated_at: string;
  total_documentos?: number;
  documentos_clasificados?: number;
  porcentaje_completado?: number;
}

export interface Unidad {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  activo: boolean;
  created_at: string;
}

export interface TipoDocumento {
  id: number;
  unidad: Unidad;
  nombre: string;
  slug: string;
  palabras_clave: string;
  activo: boolean;
  created_at: string;
}

export interface Documento {
  id: number;
  persona: Persona;
  tipo_documento: TipoDocumento | null;
  archivo_original: string;
  pagina_numero: number;
  texto_extraido: string;
  estado: 'clasificado' | 'pendiente' | 'verificado';
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
