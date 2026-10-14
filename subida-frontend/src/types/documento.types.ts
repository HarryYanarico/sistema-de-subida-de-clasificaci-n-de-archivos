/**
 * Tipos de dominio para Documentos, Folios, Ingesta y Trazabilidad.
 */
import { Persona } from './persona.types'
import { TipoDocumento } from './tipo-documento.types'

export type EstadoDocumento =
  | 'clasificado'
  | 'dudosa'
  | 'duplicado'
  | 'pendiente'
  | 'sin_clasificar'
  | 'verificado'

/** Entrada en el historial de trazabilidad de reclasificaciones humanas */
export interface EntradaHistorial {
  fecha?: string
  usuario?: string | null
  estado_anterior?: EstadoDocumento | string
  estadoAnterior?: EstadoDocumento | string
  tipo_anterior?: string | null
  tipoAnterior?: string | null
  tipo_nuevo?: string | null
  tipoNuevo?: string | null
  score_anterior?: number | null
  scoreAnterior?: number | null
  keywords_anteriores?: string[] | null
  keywordsAnteriores?: string[] | null
}

export interface Documento {
  id: number
  persona: Persona
  tipo_documento?: TipoDocumento | null
  tipoDocumento?: TipoDocumento | null
  archivo_original?: string
  archivoOriginal?: string
  archivoNombre?: string
  archivo_nombre?: string
  pagina_numero?: number
  paginaNumero: number
  texto_extraido?: string
  textoExtraido?: string
  estado: EstadoDocumento | string
  score?: number | null
  keywords_matcheadas?: string[]
  keywordsMatcheadas?: string[]
  historial_clasificacion?: EntradaHistorial[]
  historialReclasificaciones?: EntradaHistorial[] | any[]
  phash?: string | null
  duplicado_de?: string | null | any
  duplicadoDe?: Documento | null
  created_at?: string
  createdAt?: string
}

export interface DocumentoByPersona {
  persona_id: number
  documentos: Documento[]
  total_paginas: number
  clasificados: number
  pendientes: number
}

// -----------------------------------------------------------------------------
// Ingesta y Procesamiento de Lotes (Batch Upload)
// -----------------------------------------------------------------------------
export interface DetalleArchivo {
  archivo: string
  persona_id: number
  persona_codigo: string
  persona_nombre: string
  paginas: number
}

export interface ErrorArchivo {
  archivo: string
  error: string
}

export interface ResultadoBatch {
  success: boolean
  total_archivos: number
  procesados: number
  total_paginas: number
  errores: ErrorArchivo[]
  detalles: DetalleArchivo[]
}

export interface ProgresoArchivo {
  archivo: string
  estado: 'pendiente' | 'procesando' | 'completado' | 'error'
  paginas?: number
  persona_codigo?: string
  persona_nombre?: string
  persona_id?: number
  error?: string
}
