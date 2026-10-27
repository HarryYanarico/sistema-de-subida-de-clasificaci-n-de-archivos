import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { getPaginaThumbnailUrl } from '../../services/upload.service'

const PAGINAS_POR_VISTA = 12

export interface SelectorInteractivoPaginasModalProps {
  open: boolean
  grupoDestinoId: number
  grupos: Grupo[]
  onCerrar: () => void
  onTraerPagina: (
    grupoOrigenId: number,
    paginaId: number,
    slotDestino?: string
  ) => void
}

interface ItemPaginaConGrupo {
  pagina: Pagina
  grupoId: number
  numeroGrupoVisible: number
}

export function SelectorInteractivoPaginasModal({
  open,
  grupoDestinoId,
  grupos,
  onCerrar,
  onTraerPagina,
}: SelectorInteractivoPaginasModalProps) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'mismo_pdf' | 'cercanos'>('todos')
  const [paginaInterna, setPaginaInterna] = useState(1)

  const idxDestino = useMemo(() => {
    return grupos.findIndex((g) => g.id === grupoDestinoId)
  }, [grupos, grupoDestinoId])

  const grupoDestino = grupos[idxDestino]
  const pdfDestinoRef = grupoDestino?.paginas?.[0]?.pdfOrigen || ''

  // Colección aplanada de todas las páginas de los OTROS grupos
  const todasPaginasDisponibles = useMemo(() => {
    const lista: ItemPaginaConGrupo[] = []
    grupos.forEach((g, gIdx) => {
      if (g.id !== grupoDestinoId) {
        (g.paginas || []).forEach((p) => {
          lista.push({
            pagina: p,
            grupoId: g.id,
            numeroGrupoVisible: gIdx + 1,
          })
        })
      }
    })
    return lista
  }, [grupos, grupoDestinoId])

  // Filtrado y búsqueda en tiempo real
  const paginasFiltradas = useMemo(() => {
    let res = todasPaginasDisponibles

    if (filtroTipo === 'cercanos' && idxDestino >= 0) {
      const minIdx = Math.max(0, idxDestino - 5) + 1
      const maxIdx = Math.min(grupos.length, idxDestino + 6)
      res = res.filter((item) => item.numeroGrupoVisible >= minIdx && item.numeroGrupoVisible <= maxIdx)
    } else if (filtroTipo === 'mismo_pdf' && pdfDestinoRef) {
      res = res.filter((item) => item.pagina.pdfOrigen === pdfDestinoRef)
    }

    const term = busqueda.trim().toLowerCase()
    if (term) {
      res = res.filter((item) => {
        const numP = String(item.pagina.nroPaginaEnPdf)
        const pdf = (item.pagina.pdfOrigen || '').toLowerCase()
        const ocr = (item.pagina.textoOcr || '').toLowerCase()
        const numG = String(item.numeroGrupoVisible)

        return (
          numP === term ||
          pdf.includes(term) ||
          ocr.includes(term) ||
          `grupo ${numG}`.includes(term) ||
          `#${numG}` === term
        )
      })
    }

    return res
  }, [todasPaginasDisponibles, filtroTipo, idxDestino, grupos.length, pdfDestinoRef, busqueda])

  const totalPaginas = Math.ceil(paginasFiltradas.length / PAGINAS_POR_VISTA) || 1
  const paginasPaginadas = useMemo(() => {
    const inicio = (paginaInterna - 1) * PAGINAS_POR_VISTA
    return paginasFiltradas.slice(inicio, inicio + PAGINAS_POR_VISTA)
  }, [paginasFiltradas, paginaInterna])

  const handleSeleccionar = (grupoOrigenId: number, paginaId: number, slot?: string) => {
    onTraerPagina(grupoOrigenId, paginaId, slot)
    onCerrar()
  }

  const numVisibleDestino = idxDestino >= 0 ? idxDestino + 1 : '?'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCerrar()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Download className="h-5 w-5" />
            <DialogTitle className="text-lg">
              Traer página al Grupo #{numVisibleDestino}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Selecciona visualmente cualquier página disponible en otros grupos del lote para incorporarla a este documento.
          </DialogDescription>
        </DialogHeader>

        {/* Buscador y Filtros */}
        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número de página (ej: 4), texto en OCR o archivo PDF..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setPaginaInterna(1)
              }}
              className="pl-9 h-9 text-xs bg-muted/20"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" /> Filtrar:
            </span>
            <button
              type="button"
              onClick={() => {
                setFiltroTipo('todos')
                setPaginaInterna(1)
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filtroTipo === 'todos'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              Todas ({todasPaginasDisponibles.length})
            </button>
            {pdfDestinoRef && (
              <button
                type="button"
                onClick={() => {
                  setFiltroTipo('mismo_pdf')
                  setPaginaInterna(1)
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                  filtroTipo === 'mismo_pdf'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                📑 Mismo PDF original
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFiltroTipo('cercanos')
                setPaginaInterna(1)
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filtroTipo === 'cercanos'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              🎯 Grupos cercanos (±5)
            </button>
          </div>
        </div>

        {/* Galería de Páginas Disponibles */}
        <div className="flex-1 overflow-y-auto py-2 pr-1 min-h-[300px]">
          {paginasFiltradas.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-xs text-muted-foreground bg-muted/10 my-4">
              No se encontraron páginas con los criterios especificados.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {paginasPaginadas.map(({ pagina: p, grupoId, numeroGrupoVisible }) => {
                const tieneMismoPdf = pdfDestinoRef && p.pdfOrigen === pdfDestinoRef

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border bg-card hover:shadow-md transition-all flex flex-col justify-between gap-2 ${
                      tieneMismoPdf ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <Badge variant="outline" className="font-mono text-[9px] font-semibold px-1 py-0">
                          De Grupo #{numeroGrupoVisible}
                        </Badge>
                        <span className="text-[10px] font-mono font-bold">
                          Pág. {p.nroPaginaEnPdf}
                        </span>
                      </div>

                      <div className="relative w-full h-28 bg-muted/30 rounded-lg overflow-hidden border">
                        <img
                          src={getPaginaThumbnailUrl(p.id)}
                          alt=""
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {tieneMismoPdf && (
                          <Badge className="absolute top-1 right-1 bg-green-600 text-white text-[7px] px-1 py-0 font-bold">
                            Mismo PDF
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-0.5">
                        {p.pdfOrigen && (
                          <span
                            className="text-[9px] text-muted-foreground font-mono block truncate"
                            title={p.pdfOrigen}
                          >
                            {p.pdfOrigen}
                          </span>
                        )}
                        <p className="text-[10px] text-muted-foreground line-clamp-2">
                          {p.textoOcr ? p.textoOcr.slice(0, 50) : 'Sin texto OCR'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t space-y-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSeleccionar(grupoId, p.id, undefined)}
                        className="w-full h-6 text-[10px] gap-1 text-primary hover:bg-primary/10 border-primary/30"
                      >
                        <Plus className="h-3 w-3" /> Traer como siguiente
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSeleccionar(grupoId, p.id, 'Reverso')}
                        className="w-full h-6 text-[10px] gap-1 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 border-purple-300 dark:border-purple-600/30"
                      >
                        🟣 Traer como Reverso
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>
              Mostrando {paginasPaginadas.length} de {paginasFiltradas.length} páginas
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={paginaInterna === 1}
                onClick={() => setPaginaInterna((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-medium">
                {paginaInterna} / {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={paginaInterna === totalPaginas}
                onClick={() => setPaginaInterna((p) => Math.min(totalPaginas, p + 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
