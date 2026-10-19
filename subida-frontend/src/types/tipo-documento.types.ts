/**
 * Tipos de dominio para Tipos de Documento y Reglas de Clasificación.
 */

export interface TipoDocumento {
  id: number
  nombre: string
  slug: string
  color?: string
  firmaConsolidada?: Record<string, any>
  firma_consolidada?: Record<string, any>
  ejemplosPaginas?: any[]
  palabrasClave?: string
  palabras_clave?: string
  keywordsObligatorias?: string[]
  keywords_obligatorias?: string[]
  activo: boolean
  createdAt?: string
  created_at?: string
}


export type TipoDocumentoGraphQL = TipoDocumento

export interface SugerenciaKeyword {
  id: number
  palabra: string
  ratio: number
  frecuencia: number
  aceptada: boolean | null
  created_at: string
  tipo_documento?: TipoDocumento
}

export interface CreateTipoDocumentoInput {
  nombre: string
  palabrasClave: string
  keywordsObligatorias?: string[]
}

export interface UpdateTipoDocumentoInput {
  id: number
  nombre?: string
  palabrasClave?: string
  keywordsObligatorias?: string[]
  activo?: boolean
}
