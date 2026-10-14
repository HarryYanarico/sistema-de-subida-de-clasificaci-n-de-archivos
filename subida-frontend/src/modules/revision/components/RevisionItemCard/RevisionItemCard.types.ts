import { Documento, TipoDocumento } from '@app-types/index'

export interface RevisionItemCardProps {
  documento: Documento
  tipos: TipoDocumento[]
  seleccionadoTipoId?: string
  guardando: boolean
  onSeleccionarTipo: (tipoId: string) => void
  onConfirmar: () => void
  onVerDocumento: (doc: Documento) => void
  esDuplicado?: boolean
}
