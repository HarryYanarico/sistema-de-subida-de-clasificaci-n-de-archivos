import { Documento } from '@app-types/index'

export interface DocumentoViewerModalProps {
  documento: Documento | null
  open: boolean
  onClose: () => void
}
