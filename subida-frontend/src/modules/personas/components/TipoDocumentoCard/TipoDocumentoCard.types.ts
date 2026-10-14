import { Documento, TipoDocumento } from '@app-types/index'

export interface TipoDocumentoCardProps {
  tipo: TipoDocumento
  docs: Documento[]
  tipos: TipoDocumento[]
  onOpenViewer: (doc: Documento) => void
  onAsignar: (documentoId: number, tipoId: string) => void
}
