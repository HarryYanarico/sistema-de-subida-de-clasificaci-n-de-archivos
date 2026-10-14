import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Printer } from 'lucide-react'
import { HistorialReclasificacionesProps, VisorDocumentoProps } from './VisorRevision.types'

/**
 * Historial de correcciones manuales sobre un documento.
 */
export function HistorialReclasificaciones({ historial }: HistorialReclasificacionesProps) {
  if (!historial?.length) return null

  const total = historial.length

  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground">
        {total} correccion{total !== 1 ? 'es' : ''} previa{total !== 1 ? 's' : ''}
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-muted pl-3">
        {historial.map((entrada, i) => (
          <li key={i}>
            {entrada.fecha?.slice(0, 16).replace('T', ' ')} ·{' '}
            {entrada.tipo_anterior || 'sin tipo'} → {entrada.tipo_nuevo}
            {entrada.usuario && ` · por ${entrada.usuario}`}
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * Modal con la página completa del documento, para leerla antes de decidir.
 */
export function VisorDocumento({ documento, onClose }: VisorDocumentoProps) {
  const handlePrint = () => {
    if (!documento) return
    const w = window.open(`/api/documents/${documento.id}/file/`, '_blank')
    if (w) {
      w.onload = () => w.print()
    }
  }

  return (
    <Dialog open={!!documento} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-4xl !flex !flex-col !h-[85vh] !gap-0 !p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>
                {documento?.persona?.nombres} {documento?.persona?.apellidos}
              </DialogTitle>
              <DialogDescription>
                Página {documento?.paginaNumero} · {documento?.persona?.codigo}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
          {documento && (
            <iframe
              key={documento.id}
              src={`/api/documents/${documento.id}/file/`}
              className="w-full h-full border-0 rounded-lg"
              title={`Documento - Página ${documento.paginaNumero}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
