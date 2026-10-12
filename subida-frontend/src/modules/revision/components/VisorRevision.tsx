import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Printer } from 'lucide-react'

/**
 * Historial de correcciones manuales sobre un documento.
 *
 * El backend guarda una entrada por reclasificacion con el estado y tipo
 * anteriores. Se muestra plegado porque lamayoria de los documentos solo tiene
 * una entrada y no debe empujar el contenido de la tarjeta hacia abajo.
 */
export function HistorialReclasificaciones({ historial }: { historial?: any[] }) {
  if (!historial?.length) return null

  const total = historial.length

  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground">
        {total} correccion{total !== 1 ? 'es' : ''} previa{total !== 1 ? 's' : ''}
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-muted pl-3">
        {historial.map((entrada: any, i: number) => (
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
 * Modal con la pagina completa del documento, para leerla antes de decidir.
 *
 * Reutiliza `DocumentoFileView` del backend en vez de guardar otra copia en
 * miniaturas: el PDF original ya esta en MinIO y el visor lo sirve.
 */
export function VisorDocumento({
  documento,
  onClose,
}: {
  documento: any
  onClose: () => void
}) {
  const handlePrint = () => {
    if (!documento) return
    const w = window.open(`/api/documents/${documento.id}/file/`, '_blank')
    // onload puede no dispararse si el PDF abre como download; por eso el
    // print se agenda igual, y el usuario puede imprimir desde el visor.
    if (w) {
      w.onload = () => w.print()
    }
  }

  return (
    <Dialog open={!!documento} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-4xl !flex !flex-col !h-[85vh] !flex-col !gap-0 !p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>
                {documento?.persona?.nombres} {documento?.persona?.apellidos}
              </DialogTitle>
              <DialogDescription>
                Pagina {documento?.paginaNumero} · {documento?.persona?.codigo}
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
              title={`Documento - Pagina ${documento.paginaNumero}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
