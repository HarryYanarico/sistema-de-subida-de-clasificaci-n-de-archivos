import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileWarning } from 'lucide-react'

interface AlertaOrigenModalProps {
  open: boolean
  origenPagina: string
  origenDestino: string
  onConfirmar: () => void
  onCancelar: () => void
}

export function AlertaOrigenModal({
  open,
  origenPagina,
  origenDestino,
  onConfirmar,
  onCancelar,
}: AlertaOrigenModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <DialogTitle>Advertencia de Origen de Archivo</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm space-y-2">
            <span>
              La página seleccionada proviene de un archivo PDF distinto al de las páginas del documento destino:
            </span>
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-mono space-y-1">
              <div>
                <span className="font-semibold text-muted-foreground">Página a mover:</span>{' '}
                <span className="text-amber-700 dark:text-amber-300 font-bold">{origenPagina || 'Desconocido'}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Documento destino:</span>{' '}
                <span className="text-blue-700 dark:text-blue-300 font-bold">{origenDestino || 'Desconocido'}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Si unes páginas de diferentes PDFs, el documento se marcará con advertencia de <strong>origen mixto</strong> y podrá requerir verificación adicional.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex sm:justify-between gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirmar}
            className="gap-1.5"
          >
            <FileWarning className="h-4 w-4" />
            Unir de todos modos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
