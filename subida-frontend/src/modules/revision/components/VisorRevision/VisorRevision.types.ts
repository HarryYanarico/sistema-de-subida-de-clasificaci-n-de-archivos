import { Documento, EntradaHistorial } from '@app-types/index'
import { HistorialReclasificacionItem } from '../../types/revision.types'

export interface HistorialReclasificacionesProps {
  historial?: HistorialReclasificacionItem[] | EntradaHistorial[] | any[]
}

export interface VisorDocumentoProps {
  documento: Documento | null
  onClose: () => void
}
