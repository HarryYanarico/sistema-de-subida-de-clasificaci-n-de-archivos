import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Eye } from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { getPaginaThumbnailUrl } from '../../services/upload.service'
import { VisorPaginaPdfModal } from '../VisorPaginaPdfModal/VisorPaginaPdfModal'

interface GrupoPaginasModalProps {
  grupo: Grupo | null
  onClose: () => void
}

export function GrupoPaginasModal({ grupo, onClose }: GrupoPaginasModalProps) {
  const [paginaParaPdf, setPaginaParaPdf] = useState<Pagina | null>(null)

  return (
    <>
      <Dialog open={!!grupo} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 z-50">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>Todas las páginas del Grupo #{grupo?.id}</DialogTitle>
            <DialogDescription>
              Total de páginas: {grupo?.paginas?.length || 0}. Revisa las miniaturas y el texto OCR extraído.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {grupo?.paginas?.map((p: Pagina, pIdx: number) => {
              const esDosCaras = grupo?.paginas?.length === 2
              const esLadoA = esDosCaras && pIdx === 0
              const esLadoB = esDosCaras && pIdx === 1

              return (
                <div
                  key={p.id}
                  onClick={() => setPaginaParaPdf(p)}
                  className={`group border rounded-lg p-3 bg-card space-y-2.5 shadow-xs hover:shadow-md hover:border-primary transition-all duration-200 cursor-pointer relative ${
                    esLadoA
                      ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                      : esLadoB
                        ? 'border-purple-500/50 ring-1 ring-purple-500/20'
                        : ''
                  }`}
                  title={`Página ${p.nroPaginaEnPdf}: Haz clic para ver el PDF`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold gap-1">
                    <span className="group-hover:text-primary transition-colors">
                      Pág. {pIdx + 1} de {grupo?.paginas?.length || 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {esLadoA && (
                        <span className="bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          LADO A · ANVERSO
                        </span>
                      )}
                      {esLadoB && (
                        <span className="bg-purple-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          LADO B · REVERSO
                        </span>
                      )}
                      {!esDosCaras && (
                        <span className="bg-slate-800 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          PÁGINA {pIdx + 1}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        Pág. PDF {p.nroPaginaEnPdf}
                      </Badge>
                    </div>
                  </div>



                {/* Recuadro de miniatura con overlay interactivo del ojo */}
                <div className="w-full h-40 bg-muted/20 rounded overflow-hidden flex items-center justify-center border relative">
                  <img
                    src={getPaginaThumbnailUrl(p.id)}
                    alt={`Página ${p.nroPaginaEnPdf}`}
                    className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <FileText className="h-8 w-8 text-muted-foreground/30 absolute" />

                  {/* Overlay con icono de un ojo al pasar el cursor */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200 gap-1.5 backdrop-blur-[1px]">
                    <div className="p-2.5 rounded-full bg-white/20 border border-white/40 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide shadow-xs">
                      Ver PDF
                    </span>
                  </div>
                </div>

                {/* Texto OCR de muestra */}
                <div className="text-[11px] font-mono text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded border group-hover:border-primary/30 transition-colors">
                  {p.textoOcr || '(Sin texto OCR)'}
                </div>
              </div>
            )
          })}
        </div>
        </DialogContent>
      </Dialog>

      {/* Modal que muestra el PDF de la página seleccionada */}
      <VisorPaginaPdfModal
        pagina={paginaParaPdf}
        onClose={() => setPaginaParaPdf(null)}
      />
    </>
  )
}
