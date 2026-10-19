/**
 * Constantes operativas y de negocio del sistema.
 */
import { env } from './environment'
import { ROUTES } from './routes'

// Re-exportar variables de entorno para compatibilidad
export const API_URL = env.apiUrl
export const GRAPHQL_URL = env.graphqlUrl
export const API_PREFIX = env.apiPrefix
export { ROUTES }

// -----------------------------------------------------------------------------
// Paginación y Carga
// -----------------------------------------------------------------------------
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  REVISION_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
} as const

// -----------------------------------------------------------------------------
// Restricciones de Carga de Archivos
// -----------------------------------------------------------------------------
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  ACCEPTED_MIME_TYPES: ['application/pdf'] as const,
  ACCEPTED_EXTENSIONS: ['.pdf'] as const,
  MIN_CODIGO_DIGITS: 4,
} as const

// -----------------------------------------------------------------------------
// Estados de Documentos (Mapeo exacto con Django)
// -----------------------------------------------------------------------------
export const DOCUMENTO_ESTADOS = {
  CLASIFICADO: 'clasificado',
  DUDOSA: 'dudosa',
  DUPLICADO: 'duplicado',
  DUPLICADA: 'duplicada',
  PENDIENTE: 'pendiente',
  SIN_CLASIFICAR: 'sin_clasificar',
  VERIFICADO: 'verificado',
} as const

export type DocumentoEstado = typeof DOCUMENTO_ESTADOS[keyof typeof DOCUMENTO_ESTADOS]

// -----------------------------------------------------------------------------
// Umbrales del Clasificador Local
// -----------------------------------------------------------------------------
export const CLASIFICADOR = {
  /** Umbral difuso mínimo para matcheo de tokens con rapidfuzz */
  UMBRAL_FUZZY: 75,
  /** Distancia Hamming máxima para considerar un pHash como duplicado */
  MAX_HAMMING_DISTANCE: 5,
  /** Score mínimo para no ser catalogado como dudoso */
  SCORE_MINIMO_CONFIANZA: 0.6,
} as const

// -----------------------------------------------------------------------------
// Claves de Almacenamiento Local (LocalStorage)
// -----------------------------------------------------------------------------
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
} as const
