import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, FileText, Eye, Layers } from 'lucide-react'
import { Pagina } from '@app-types/documento.types'
import { getPaginaPdfUrl } from '../../services/upload.service'

interface VisorPaginaPdfModalProps {
  pagina: Pagina | null
  onClose: () => void
}

export function VisorPaginaPdfModal({ pagina, onClose }: VisorPaginaPdfModalProps) {
  const [mostrarOcr, setMostrarOcr] = useState(false)

  if (!pagina) return null

  const pdfUrl = getPaginaPdfUrl(pagina.id)

  const handleOpenExternal = () => {
    window.open(pdfUrl, '_blank')
  }

  return (
    <Dialog open={!!pagina} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-5 z-[70]">
        <DialogHeader className="border-b pb-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>Página #{pagina.nroPaginaEnPdf} en PDF</span>
                  <Badge variant="outline" className="text-xs font-mono font-medium">
                    ID #{pagina.id}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Lote:{' '}
                  <span className="font-medium text-foreground">
                    {pagina.loteNombre || pagina.pdfOrigen || `Lote #${pagina.loteId}`}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mostrarOcr ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMostrarOcr((prev) => !prev)}
                className="h-8 text-xs gap-1.5"
              >
                {mostrarOcr ? (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Ver PDF</span>
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    <span>Ver Texto OCR</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="h-8 text-xs gap-1.5 text-primary hover:text-primary"
                title="Abrir el PDF en una pestaña nueva del navegador para zoom nativo"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abrir en pestaña nueva</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Visor interactivo: PDF o Texto OCR */}
        <div className="flex-1 w-full h-full min-h-0 pt-3 flex flex-col">
          {mostrarOcr ? (
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-lg border font-mono text-xs whitespace-pre-wrap leading-relaxed">
              <div className="flex items-center justify-between border-b pb-2 mb-3 font-sans font-semibold text-foreground text-xs">
                <span>Texto OCR extraído de la página #{pagina.nroPaginaEnPdf}</span>
                <span className="text-muted-foreground font-normal">
                  {pagina.textoOcr ? `${pagina.textoOcr.length} caracteres` : '0 caracteres'}
                </span>
              </div>
              {pagina.textoOcr ? (
                pagina.textoOcr
              ) : (
                <span className="text-muted-foreground italic">
                  No se detectó texto OCR legible en esta página.
                </span>
              )}
            </div>
          ) : (
            <div className="flex-1 w-full h-full min-h-0 bg-muted/20 rounded-lg border overflow-hidden relative shadow-inner">
              <iframe
                src={pdfUrl}
                title={`Página ${pagina.nroPaginaEnPdf} PDF`}
                className="w-full h-full border-0"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
