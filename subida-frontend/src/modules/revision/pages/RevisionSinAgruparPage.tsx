import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react'
import { Pagina } from '@app-types/documento.types'
import { useRevisionSinAgrupar } from '../hooks/useRevisionSinAgrupar'
import { PaginaHuerfanaCard } from '../components/PaginaHuerfanaCard/PaginaHuerfanaCard'
import { getPaginaThumbnailUrl } from '@modules/documentos/services/upload.service'

export function RevisionSinAgruparPage() {
  const {
    paginas,
    tipos,
    loading,
    error,
    guardandoId,
    errorAccion,
    hayMas,
    getEstadoTarjeta,
    setModo,
    setTipoId,
    setNombreNuevo,
    handleConfirmar,
    cargarMas,
    recargarCola,
  } = useRevisionSinAgrupar()

  // Modal para ver página completa / OCR
  const [paginaParaModal, setPaginaParaModal] = useState<Pagina | null>(null)

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Cola Residual: Páginas Sin Agrupar
              </h1>
              <p className="text-sm text-muted-foreground">
                Páginas no resueltas por el clasificador automático (OCR borroso, escaneos atípicos
                o texto aislado)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-mono">
            {paginas.length}{' '}
            {paginas.length === 1 ? 'página pendiente' : 'páginas pendientes'}
          </Badge>
          <Button variant="outline" size="sm" onClick={recargarCola} disabled={loading}>
            Refrescar
          </Button>
        </div>
      </div>

      {/* Estados de carga y error global */}
      {loading && paginas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Consultando páginas residuales...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error.message}</span>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && paginas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-semibold">Cola residual limpia</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No hay páginas pendientes de revisión manual. Todos los documentos fueron agrupados o
              clasificados con éxito.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de Tarjetas */}
      {paginas.length > 0 && (
        <div className="space-y-4">
          {paginas.map((pagina: Pagina) => {
            const config = getEstadoTarjeta(pagina.id)
            const estaGuardando = guardandoId === pagina.id
            const errorFila = errorAccion?.id === pagina.id ? errorAccion?.mensaje : null

            return (
              <PaginaHuerfanaCard
                key={pagina.id}
                pagina={pagina}
                config={config}
                tipos={tipos}
                estaGuardando={estaGuardando}
                errorFila={errorFila}
                onSetModo={setModo}
                onSetTipoId={setTipoId}
                onSetNombreNuevo={setNombreNuevo}
                onConfirmar={handleConfirmar}
                onVerModal={setPaginaParaModal}
              />
            )
          })}

          {hayMas && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={cargarMas} disabled={loading}>
                {loading ? 'Cargando más...' : 'Cargar más páginas'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal para ver página completa y OCR */}
      <Dialog open={!!paginaParaModal} onOpenChange={(open) => !open && setPaginaParaModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>
              Detalle de Página #{paginaParaModal?.id} (Pág. {paginaParaModal?.nroPaginaEnPdf} en PDF)
            </DialogTitle>
            <DialogDescription>
              Lote:{' '}
              {paginaParaModal?.loteNombre ||
                paginaParaModal?.pdfOrigen ||
                `#${paginaParaModal?.loteId}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {paginaParaModal && (
              <div className="w-full h-72 bg-muted/20 rounded border flex items-center justify-center overflow-hidden relative">
                <img
                  src={getPaginaThumbnailUrl(paginaParaModal.id)}
                  alt={`Página ${paginaParaModal.nroPaginaEnPdf}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <FileText className="h-12 w-12 text-muted-foreground/30 absolute" />
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Texto OCR Completo
              </span>
              <div className="p-4 bg-muted/40 rounded-lg border text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {paginaParaModal?.textoOcr || '(Sin texto OCR reconocido)'}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const RevisionSinAgrupar = RevisionSinAgruparPage
