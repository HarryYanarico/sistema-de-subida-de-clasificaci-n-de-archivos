import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Eye, X, Loader2 } from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { DecisionGrupo } from '../../hooks/useAgruparLote'
import {
  getPaginaThumbnailUrl,
  formatearOrigenPagina,
} from '../../services/upload.service'
import { VisorPaginaPdfModal } from '../VisorPaginaPdfModal/VisorPaginaPdfModal'

interface GrupoPaginasModalProps {
  grupo: Grupo | null
  decision?: DecisionGrupo
  onClose: () => void
  onDescartarPagina?: (grupoId: number, paginaId: number) => Promise<void> | void
}

export function GrupoPaginasModal({
  grupo,
  decision,
  onClose,
  onDescartarPagina,
}: GrupoPaginasModalProps) {
  const [paginaParaPdf, setPaginaParaPdf] = useState<Pagina | null>(null)
  const [descartandoId, setDescartandoId] = useState<number | null>(null)

  const esGrupoDescartadas = grupo?.estado === 'descartadas'
  const estaConcatenado =
    Boolean(decision?.modoEstructura) && decision?.modoEstructura !== 'INDEPENDIENTE'

  const handleDescartar = async (e: React.MouseEvent, paginaId: number) => {
    e.stopPropagation()
    if (!grupo || !onDescartarPagina || descartandoId !== null) return
    setDescartandoId(paginaId)
    try {
      await onDescartarPagina(grupo.id, paginaId)
    } finally {
      setDescartandoId(null)
    }
  }

  return (
    <>
      <Dialog open={!!grupo} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 z-50">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>
              {esGrupoDescartadas
                ? 'Páginas en Grupo "Descartadas"'
                : `Todas las páginas del Grupo #${grupo?.id}`}
            </DialogTitle>
            <DialogDescription>
              Total de páginas: {grupo?.paginas?.length || 0}. Haz clic en cualquier página para ver el PDF completo o usa la X para moverla a &quot;Descartadas&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {grupo?.paginas?.map((p: Pagina, pIdx: number) => {
              const ordenBloque = estaConcatenado
                ? decision?.ordenPaginas?.[p.id] ||
                  (decision?.modoEstructura === 'ANVERSO_REVERSO' ? (pIdx % 2) + 1 : pIdx + 1)
                : 1
              const esAnversoReverso = decision?.modoEstructura === 'ANVERSO_REVERSO'
              const esLadoA = estaConcatenado && esAnversoReverso && ordenBloque === 1
              const esLadoB = estaConcatenado && esAnversoReverso && ordenBloque === 2
              const etiquetaOrigen = formatearOrigenPagina(p.pdfOrigen, p.nroPaginaEnPdf)

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
                  title={`${etiquetaOrigen}: Haz clic para ver el PDF completo`}
                >
                  {/* RF-16 / RT-08: Botón X para descartar la página del grupo hacia "Descartadas" */}
                  {!esGrupoDescartadas && onDescartarPagina && (
                    <button
                      type="button"
                      data-testid={`btn-descartar-pagina-${p.id}`}
                      onClick={(e) => handleDescartar(e, p.id)}
                      disabled={descartandoId === p.id}
                      className="absolute -top-2 -right-2 z-30 h-6 w-6 rounded-full bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer disabled:opacity-50"
                      title="Descartar página de este grupo (mover a Descartadas)"
                    >
                      {descartandoId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  <div className="flex items-center justify-between text-xs font-semibold gap-1 pr-3">
                    <span className="group-hover:text-primary transition-colors">
                      Ejemplar {pIdx + 1} de {grupo?.paginas?.length || 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {esLadoA && (
                        <span className="bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          PÁGINA 1 · ANVERSO
                        </span>
                      )}
                      {esLadoB && (
                        <span className="bg-purple-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          PÁGINA 2 · REVERSO
                        </span>
                      )}
                      {estaConcatenado && !esLadoA && !esLadoB && (
                        <span className="bg-slate-800 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          PÁGINA {ordenBloque}
                        </span>
                      )}
                      {!estaConcatenado && (
                        <span className="bg-muted text-muted-foreground font-semibold text-[9px] px-1.5 py-0.5 rounded border">
                          PÁGINA 1 (INDEPENDIENTE)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Etiqueta de origen (pdf_XX.pdf, pág N) */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono truncate max-w-full"
                      title={etiquetaOrigen}
                    >
                      {etiquetaOrigen}
                    </Badge>
                  </div>

                  {/* Recuadro de miniatura con overlay interactivo del ojo */}
                  <div className="w-full h-40 bg-muted/20 rounded overflow-hidden flex items-center justify-center border relative">
                    <img
                      src={getPaginaThumbnailUrl(p.id)}
                      alt={etiquetaOrigen}
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
                        Ver PDF completo
                      </span>
                    </div>
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
