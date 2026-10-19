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

export interface Pagina {
  id: number
  loteId: number | string
  pdfOrigen: string
  nroPaginaEnPdf: number
  textoOcr: string
  firmaPalabras?: string[]
  firmaEstructura?: Record<string, any>
  phash?: string | null
  descartable?: boolean
  grupo?: Grupo | null
  estado: 'pendiente' | 'agrupada' | 'confirmada' | 'descartada' | 'sin_agrupar' | 'duplicada' | string
  createdAt?: string
}

export interface ParejaSugerida {
  paginaAnversoId: string | number
  paginaReversoId: string | number
}

export interface Grupo {
  id: number
  loteId: number | string
  firmaConsolidada?: Record<string, any>
  totalPaginas: number
  tipoDocumentoSugerido?: TipoDocumento | null
  estado: 'nuevo' | 'coincide_con_tipo' | 'confirmado' | 'rechazado' | string
  paginas?: Pagina[]
  parejasSugeridas?: ParejaSugerida[]
  createdAt?: string
}

export interface Lote {
  id: number
  estado: 'procesando' | 'pendiente_nombres' | 'confirmado' | 'descartado' | string
  nombreArchivoOriginal: string
  totalPaginas: number
  totalGrupos: number
  grupos?: Grupo[]
  paginas?: Pagina[]
  documentos?: Documento[]
  parejasSugeridas?: ParejaSugerida[]
  createdAt?: string
}

export interface Documento {
  id: number
  persona?: Persona | null

  tipo_documento?: TipoDocumento | null
  tipoDocumento?: TipoDocumento | null
  archivo_original?: string
  archivoOriginal?: string
  archivoNombre?: string
  archivo_nombre?: string
  pagina_numero?: number
  paginaNumero?: number
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
  // Nuevos campos Fase 2:
  lote?: Lote | null
  paginas?: Pagina[]
  esDobleCara?: boolean
  nombreFinal?: string
  totalPaginas?: number
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
