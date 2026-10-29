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
  | 'incompleto'
  | 'sin_clasificar'
  | 'verificado'

/** Entrada en el historial de trazabilidad de reclasificaciones humanas */
export interface EntradaHistorial {
  fecha?: string
  usuario?: string | null
  estadoAnterior?: EstadoDocumento | string
  tipoAnterior?: string | null
  tipoNuevo?: string | null
  scoreAnterior?: number | null
  keywordsAnteriores?: string[] | null
}

export interface Pagina {
  id: number
  loteId: number | string
  loteNombre?: string | null
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
  estado: 'nuevo' | 'coincide_con_tipo' | 'confirmado' | 'rechazado' | 'fusionado' | 'descartadas' | string
  paginas?: Pagina[]
  documentos?: Documento[]
  parejasSugeridas?: ParejaSugerida[]
  createdAt?: string
}

export interface Lote {
  id: number
  estado: 'procesando' | 'pendiente_nombres' | 'confirmado' | 'descartado' | string
  nombreArchivoOriginal: string
  totalPaginas: number
  totalGrupos: number
  borradorAgrupamiento?: Record<string, any> | null
  persona?: Persona | null
  grupos?: Grupo[]
  paginas?: Pagina[]
  documentos?: Documento[]
  parejasSugeridas?: ParejaSugerida[]
  createdAt?: string
}

export type ModoEstructura = 'INDEPENDIENTE' | 'SECUENCIAL' | 'ANVERSO_REVERSO' | 'MIXTA' | 'MULTIPAGINA'

export interface SlotInfo {
  paginaId: number
  slot: string
  orden: number
  etiqueta?: string
  pdfOrigen?: string
}

export interface LoteRevisionData {
  lote: Lote
  documentosIncompletos: Documento[]
  paginasHuerfanas: Pagina[]
}

export interface Documento {
  id: number
  persona?: Persona | null
  tipoDocumento?: TipoDocumento | null
  archivoOriginal?: string
  archivoNombre?: string
  paginaNumero?: number
  textoExtraido?: string
  estado: EstadoDocumento | string
  score?: number | null
  keywordsMatcheadas?: string[]
  historialReclasificaciones?: EntradaHistorial[]
  phash?: string | null
  duplicadoDe?: Documento | null
  createdAt?: string
  lote?: Lote | null
  paginas?: Pagina[]
  esDobleCara?: boolean
  nombreFinal?: string
  totalPaginas?: number
}

/**
 * Adaptador centralizado para normalizar entradas de historial snake_case o camelCase.
 */
export function adaptEntradaHistorial(raw: any): EntradaHistorial {
  if (!raw) return {}
  return {
    fecha: raw.fecha,
    usuario: raw.usuario,
    estadoAnterior: raw.estadoAnterior ?? raw.estado_anterior,
    tipoAnterior: raw.tipoAnterior ?? raw.tipo_anterior,
    tipoNuevo: raw.tipoNuevo ?? raw.tipo_nuevo,
    scoreAnterior: raw.scoreAnterior ?? raw.score_anterior,
    keywordsAnteriores: raw.keywordsAnteriores ?? raw.keywords_anteriores,
  }
}

/**
 * Adaptador centralizado para normalizar respuestas del backend a la interfaz Documento unificada.
 */
export function adaptDocumento(raw: any): Documento {
  if (!raw) return {} as Documento
  return {
    id: raw.id,
    persona: raw.persona,
    tipoDocumento: raw.tipoDocumento ?? raw.tipo_documento,
    archivoOriginal: raw.archivoOriginal ?? raw.archivo_original,
    archivoNombre: raw.archivoNombre ?? raw.archivo_nombre ?? raw.nombreArchivoOriginal,
    paginaNumero: raw.paginaNumero ?? raw.pagina_numero,
    textoExtraido: raw.textoExtraido ?? raw.texto_extraido,
    estado: raw.estado,
    score: raw.score,
    keywordsMatcheadas: raw.keywordsMatcheadas ?? raw.keywords_matcheadas ?? [],
    historialReclasificaciones: (raw.historialReclasificaciones ?? raw.historial_clasificacion ?? []).map(adaptEntradaHistorial),
    phash: raw.phash,
    duplicadoDe: raw.duplicadoDe ?? raw.duplicado_de,
    createdAt: raw.createdAt ?? raw.created_at,
    lote: raw.lote ? adaptLote(raw.lote) : undefined,
    paginas: raw.paginas ? raw.paginas.map(adaptPagina) : undefined,
    esDobleCara: raw.esDobleCara ?? raw.es_doble_cara,
    nombreFinal: raw.nombreFinal ?? raw.nombre_final,
    totalPaginas: raw.totalPaginas ?? raw.total_paginas,
  }
}

/**
 * Adaptador centralizado para normalizar páginas.
 */
export function adaptPagina(raw: any): Pagina {
  if (!raw) return {} as Pagina
  return {
    id: raw.id,
    loteId: raw.loteId ?? raw.lote_id,
    loteNombre: raw.loteNombre ?? raw.lote_nombre,
    pdfOrigen: raw.pdfOrigen ?? raw.pdf_origen,
    nroPaginaEnPdf: raw.nroPaginaEnPdf ?? raw.nro_pagina_en_pdf,
    textoOcr: raw.textoOcr ?? raw.texto_ocr ?? '',
    firmaPalabras: raw.firmaPalabras ?? raw.firma_palabras,
    firmaEstructura: raw.firmaEstructura ?? raw.firma_estructura,
    phash: raw.phash,
    descartable: raw.descartable,
    grupo: raw.grupo,
    estado: raw.estado,
    createdAt: raw.createdAt ?? raw.created_at,
  }
}

/**
 * Adaptador centralizado para normalizar lotes.
 */
export function adaptLote(raw: any): Lote {
  if (!raw) return {} as Lote
  return {
    id: raw.id,
    estado: raw.estado,
    nombreArchivoOriginal: raw.nombreArchivoOriginal ?? raw.nombre_archivo_original,
    totalPaginas: raw.totalPaginas ?? raw.total_paginas,
    totalGrupos: raw.totalGrupos ?? raw.total_grupos,
    persona: raw.persona,
    grupos: raw.grupos,
    paginas: raw.paginas ? raw.paginas.map(adaptPagina) : undefined,
    documentos: raw.documentos ? raw.documentos.map(adaptDocumento) : undefined,
    parejasSugeridas: raw.parejasSugeridas ?? raw.parejas_sugeridas,
    createdAt: raw.createdAt ?? raw.created_at,
  }
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
