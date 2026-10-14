import { Documento, TipoDocumento, Persona } from '@app-types/index'

export interface PendientesPersonaGroupProps {
  persona: Persona
  documentos: Documento[]
  tipos: TipoDocumento[]
  asignandoId: number | null
  onAsignar: (documentoId: number, tipoDocumentoId: string) => void
  onVerDocumento: (documento: Documento) => void
}
