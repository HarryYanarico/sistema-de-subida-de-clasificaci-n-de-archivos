import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Printer } from 'lucide-react'
import { getDocumentFileUrl, printDocument } from '../../services/upload.service'
import { DocumentoViewerModalProps } from './DocumentoViewerModal.types'

export function DocumentoViewerModal({
  documento,
  open,
  onClose,
}: DocumentoViewerModalProps) {
  if (!documento) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>
              {documento.persona
                ? `${documento.persona.nombres} ${documento.persona.apellidos} - Pág. ${documento.paginaNumero}`
                : `Folio #${documento.id}`}
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => printDocument(documento.id)}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </DialogHeader>
        <div className="flex-1 w-full h-full min-h-0 pt-2">
          <iframe
            src={getDocumentFileUrl(documento.id)}
            className="w-full h-full rounded border bg-muted/20"
            title={`Documento ${documento.id}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
