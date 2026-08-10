export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const GRAPHQL_URL = `${API_URL}/graphql/`;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  PERSONAS: '/personas',
  PERSONA_DETAIL: '/personas/:id',
  DOCUMENTOS: '/documentos',
  DOCUMENTOS_PENDIENTES: '/documentos/pendientes',
  CONFIGURACION: '/configuracion',
  TIPOS_DOCUMENTO: '/configuracion/tipos-documento',
  UNIDADES: '/configuracion/unidades',
} as const;
