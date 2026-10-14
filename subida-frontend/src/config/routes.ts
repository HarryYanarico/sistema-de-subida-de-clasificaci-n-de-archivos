/**
 * Diccionario centralizado de rutas del sistema.
 * Evita el uso de cadenas de texto dispersas (magic strings) en componentes y enlaces.
 */

export const ROUTES = {
  // Autenticación
  LOGIN: '/login',

  // Dashboard general
  DASHBOARD: '/',

  // Módulo de Documentos
  DOCUMENTOS: {
    ROOT: '/documentos',
    SUBIR: '/documentos/subir',
    PENDIENTES: '/documentos/pendientes',
  },

  // Módulo de Colas de Revisión Humana
  REVISION: {
    ROOT: '/revision',
    DUDOSAS: '/revision/dudosas',
    SIN_CLASIFICAR: '/revision/sin-clasificar',
    DUPLICADOS: '/revision/duplicados',
  },

  // Módulo de Configuración y Tipos de Documento
  CONFIGURACION: {
    ROOT: '/configuracion',
    TIPOS_DOCUMENTO: '/configuracion/tipos-documento',
  },

  // Módulo de Personas y Casilleros
  PERSONAS: {
    ROOT: '/personas',
    REGISTRAR: '/personas/registrar',
    CASILLERO: (id: string | number = ':id') => `/personas/${id}/casillero`,
    VISTA_LISTA: '/vista-persona',
    VISTA_DETALLE: (id: string | number = ':id') => `/vista-persona/${id}`,
  },
} as const

// Tipos auxiliares derivados del diccionario
export type AppRoutePaths = typeof ROUTES
