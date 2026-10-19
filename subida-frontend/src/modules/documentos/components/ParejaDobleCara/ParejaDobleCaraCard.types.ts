import { Pagina } from '@app-types/documento.types'

export interface DocumentoBorrador {
  id: string
  nombre: string
  esDobleCara: boolean
  paginas: Pagina[]
  advertencia?: string | null
}

export interface ParejaDobleCaraCardProps {
  documento: DocumentoBorrador
  onToggleDobleCara: (docId: string, checked: boolean) => void
  onAgregarPagina?: (docId: string, paginaId: number) => void
  onQuitarPagina?: (docId: string, paginaId: number) => void
  onVerPagina?: (pagina: Pagina) => void
  paginasDisponibles?: Pagina[]
  disabled?: boolean
}
