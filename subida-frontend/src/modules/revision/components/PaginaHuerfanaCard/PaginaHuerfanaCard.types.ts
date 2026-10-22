import { Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { EstadoTarjetaPagina, ModoAccionPagina } from '../../hooks/useRevisionSinAgrupar'

export interface PaginaHuerfanaCardProps {
  pagina: Pagina
  config: EstadoTarjetaPagina
  tipos: TipoDocumento[]
  estaGuardando: boolean
  errorFila: string | null
  onSetModo: (paginaId: number, modo: ModoAccionPagina) => void
  onSetTipoId: (paginaId: number, tipoId: string) => void
  onSetNombreNuevo: (paginaId: number, nombreNuevo: string) => void
  onConfirmar: (pagina: Pagina) => void
  onVerModal: (pagina: Pagina) => void
}
