/**
 * Tipos de dominio para Personas y Casilleros individuales.
 */

export interface Persona {
  id: number
  codigo: string
  nombres: string
  apellidos: string
  ci?: string | null
  email?: string | null
  telefono?: string | null
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  total_documentos?: number
  totalDocumentos?: number
  documentos_clasificados?: number
  documentosClasificados?: number
  porcentaje_completado?: number
  porcentajeCompletado?: number
  tiene_documentos_clasificados?: boolean
  tieneDocumentosClasificados?: boolean
}

export interface PersonaConnection {
  items: Persona[]
  total: number
  page: number
  totalPages: number
}

export interface CreatePersonaInput {
  codigo: string
  nombres: string
  apellidos: string
  ci?: string
  email?: string
  telefono?: string
}

export interface UpdatePersonaInput {
  id: number
  codigo?: string
  nombres?: string
  apellidos?: string
  ci?: string
  email?: string
  telefono?: string
}
