import { Documento } from '@app-types/index'

export interface HistorialReclasificacionItem {
  fecha?: string
  tipo_anterior?: string | null
  tipo_nuevo?: string | null
  usuario?: string | null
}

export interface EstadoColaRevision {
  documentos: Documento[]
  loading: boolean
  error: string | null
  recargar: () => void
  cargarMas: () => void
  hayMas: boolean
}
