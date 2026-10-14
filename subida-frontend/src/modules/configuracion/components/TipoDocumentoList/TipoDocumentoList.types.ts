import { TipoDocumento } from '@app-types/index'

export interface TipoDocumentoListProps {
  tipos: TipoDocumento[]
  loading: boolean
  onEdit: (tipo: TipoDocumento) => void
  onDelete: (id: number) => void
}
