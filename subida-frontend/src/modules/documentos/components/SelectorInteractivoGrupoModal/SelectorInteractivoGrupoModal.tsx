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
  Layers,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { DecisionGrupo } from '../../hooks/useAgruparLote'
import {
  getPaginaThumbnailUrl,
  formatearOrigenPagina,
} from '../../services/upload.service'

const CARDS_POR_PAGINA = 12

export interface SelectorInteractivoGrupoModalProps {
  open: boolean
  modo: 'mover_pagina' | 'fusionar_grupo'
  grupoOrigenId: number
  paginaOrigen?: Pagina
  grupos: Grupo[]
  decisiones: Record<number, DecisionGrupo>
  onCerrar: () => void
  onSeleccionarDestino: (
    grupoDestinoId: number,
    slotDestino?: string
  ) => void
  onFusionarMultiples?: (
    gruposOrigenIds: number[],
    grupoDestinoId: number
  ) => void
}

export function SelectorInteractivoGrupoModal({
  open,
  modo,
  grupoOrigenId,
  paginaOrigen,
  grupos,
  decisiones,
  onCerrar,
  onSeleccionarDestino,
  onFusionarMultiples,
}: SelectorInteractivoGrupoModalProps) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'cercanos' | 'mismo_pdf' | 'con_slots'>('todos')
  const [paginaInterna, setPaginaInterna] = useState(1)
  const [seleccionadosFusion, setSeleccionadosFusion] = useState<number[]>([])

  // Obtener grupo de origen e índice
  const idxOrigen = useMemo(() => {
    return grupos.findIndex((g) => g.id === grupoOrigenId)
  }, [grupos, grupoOrigenId])

  const grupoOrigen = grupos[idxOrigen]
  const pdfOrigenRef = paginaOrigen?.pdfOrigen || grupoOrigen?.paginas?.[0]?.pdfOrigen || ''

  // Filtrar grupos que no sean el grupo de origen ni el grupo especial Descartadas
  const otrosGrupos = useMemo(() => {
    return grupos.filter((g) => g.id !== grupoOrigenId && g.estado !== 'descartadas')
  }, [grupos, grupoOrigenId])

  // Aplicar filtros y búsqueda en tiempo real
  const gruposFiltrados = useMemo(() => {
    let res = otrosGrupos

    // 1. Filtros por chip
    if (filtroTipo === 'cercanos' && idxOrigen >= 0) {
      const minIdx = Math.max(0, idxOrigen - 5)
      const maxIdx = Math.min(grupos.length - 1, idxOrigen + 5)
      res = res.filter((g) => {
        const i = grupos.findIndex((item) => item.id === g.id)
        return i >= minIdx && i <= maxIdx
      })
    } else if (filtroTipo === 'mismo_pdf' && pdfOrigenRef) {
      res = res.filter((g) => {
        return (g.paginas || []).some((p) => p.pdfOrigen === pdfOrigenRef)
      })
    } else if (filtroTipo === 'con_slots') {
      res = res.filter((g) => {
        const dec = decisiones[g.id]
        const pags = g.paginas || []
        const esperados = dec?.slotsEsperados || (dec?.modoEstructura === 'ANVERSO_REVERSO' ? 2 : pags.length)
        return pags.length < esperados
      })
    }

    // 2. Búsqueda por texto (número de grupo, nombre de tipo o archivo PDF)
    const term = busqueda.trim().toLowerCase()
    if (term) {
      res = res.filter((g) => {
        const numVisible = grupos.findIndex((item) => item.id === g.id) + 1
        const dec = decisiones[g.id]
        const nombreDoc = (dec?.nombreNuevo || g.tipoDocumentoSugerido?.nombre || '').toLowerCase()
        const pdfPags = (g.paginas || []).map((p) => (p.pdfOrigen || '').toLowerCase()).join(' ')

        const coincideNumero =
          term.startsWith('#')
            ? String(numVisible) === term.slice(1)
            : String(numVisible) === term
        const coincideNombre = nombreDoc.includes(term)
        const coincidePdf = pdfPags.includes(term)

        return coincideNumero || coincideNombre || coincidePdf
      })
    }

    return res
  }, [otrosGrupos, filtroTipo, idxOrigen, grupos, pdfOrigenRef, decisiones, busqueda])

  // Paginación interna de la galería
  const totalPaginas = Math.ceil(gruposFiltrados.length / CARDS_POR_PAGINA) || 1
  const gruposPaginados = useMemo(() => {
    const inicio = (paginaInterna - 1) * CARDS_POR_PAGINA
    return gruposFiltrados.slice(inicio, inicio + CARDS_POR_PAGINA)
  }, [gruposFiltrados, paginaInterna])

  const handleSeleccionar = (destId: number, slot?: string) => {
    setSeleccionadosFusion([])
    onSeleccionarDestino(destId, slot)
    onCerrar()
  }

  const toggleSeleccionFusion = (id: number) => {
    setSeleccionadosFusion((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleConfirmarFusionMultiple = () => {
    if (seleccionadosFusion.length === 0) return
    if (onFusionarMultiples) {
      onFusionarMultiples(seleccionadosFusion, grupoOrigenId)
    } else {
      seleccionadosFusion.forEach((id) => onSeleccionarDestino(id))
    }
    setSeleccionadosFusion([])
    onCerrar()
  }

  const numVisibleOrigen = idxOrigen >= 0 ? idxOrigen + 1 : '?'

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSeleccionadosFusion([])
          onCerrar()
        }
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Layers className="h-5 w-5" />
              <DialogTitle className="text-lg">
                {modo === 'mover_pagina'
                  ? `Mover Página #${paginaOrigen?.nroPaginaEnPdf || ''} a otro grupo`
                  : `Concatenar / Fusionar grupos con Grupo #${numVisibleOrigen}`}
              </DialogTitle>
            </div>
            {modo === 'fusionar_grupo' && seleccionadosFusion.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmarFusionMultiple}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Fusionar {seleccionadosFusion.length} grupo(s) seleccionado(s)
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs">
            {modo === 'mover_pagina'
              ? 'Selecciona visualmente el grupo de destino donde deseas incorporar esta página.'
              : 'Selecciona uno o varios grupos para concatenar sus páginas dentro de este grupo. Los grupos absorbidos desaparecerán de la lista.'}
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Búsqueda y Chips de Filtro */}
        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número (ej: #14), nombre (ej: TITULO) o archivo PDF..."
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
              Todos ({otrosGrupos.length})
            </button>
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
              🎯 Cercanos (±5)
            </button>
            {pdfOrigenRef && (
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
                setFiltroTipo('con_slots')
                setPaginaInterna(1)
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filtroTipo === 'con_slots'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              ⚠️ Con slots vacíos
            </button>
          </div>
        </div>

        {/* Galería de Tarjetas de Grupos Destino */}
        <div className="flex-1 overflow-y-auto py-2 pr-1 min-h-[300px]">
          {gruposFiltrados.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-xs text-muted-foreground bg-muted/10 my-4">
              No se encontraron grupos que coincidan con la búsqueda o filtro aplicado.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gruposPaginados.map((g) => {
                const numVisible = grupos.findIndex((item) => item.id === g.id) + 1
                const primeraPag = (g.paginas || [])[0]
                const dec = decisiones[g.id]
                const nombreDoc = dec?.nombreNuevo || g.tipoDocumentoSugerido?.nombre || 'Sin nombrar'
                const pags = g.paginas || []
                const tieneMismoPdf = pdfOrigenRef && pags.some((p) => p.pdfOrigen === pdfOrigenRef)

                return (
                  <div
                    key={g.id}
                    className={`p-2.5 rounded-xl border bg-card hover:shadow-md transition-all flex flex-col justify-between gap-2 ${
                      tieneMismoPdf ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold px-1.5 py-0">
                          Grupo #{numVisible}
                        </Badge>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {pags.length} {pags.length === 1 ? 'pág' : 'págs'}
                        </span>
                      </div>

                      {/* Miniatura representativa */}
                      <div className="relative w-full h-24 bg-muted/30 rounded-lg overflow-hidden border">
                        {primeraPag ? (
                          <img
                            src={getPaginaThumbnailUrl(primeraPag.id)}
                            alt=""
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                        {tieneMismoPdf && (
                          <Badge className="absolute top-1 right-1 bg-green-600 text-white text-[7px] px-1 py-0 font-bold">
                            Mismo PDF
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1.5">
                        <span className="text-xs font-bold block truncate" title={nombreDoc}>
                          {nombreDoc}
                        </span>
                        {primeraPag && (
                          <span
                            className="text-[9px] text-muted-foreground font-mono block truncate"
                            title={formatearOrigenPagina(primeraPag.pdfOrigen, primeraPag.nroPaginaEnPdf)}
                          >
                            {formatearOrigenPagina(primeraPag.pdfOrigen, primeraPag.nroPaginaEnPdf)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción Directa */}
                    <div className="pt-2 border-t space-y-1">
                      {modo === 'mover_pagina' ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleSeleccionar(g.id, undefined)}
                            className="w-full h-6 text-[10px] gap-1 text-primary hover:bg-primary/10 border-primary/30"
                          >
                            <Plus className="h-3 w-3" /> Como Pág. {pags.length + 1}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleSeleccionar(g.id, 'Reverso')}
                            className="w-full h-6 text-[10px] gap-1 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 border-purple-300 dark:border-purple-600/30"
                          >
                            🟣 Como Reverso (Lado B)
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSeleccionar(g.id)}
                            className="w-full h-7 text-xs gap-1 font-semibold"
                          >
                            <ArrowRight className="h-3.5 w-3.5" /> Fusionar ahora
                          </Button>
                          <button
                            type="button"
                            onClick={() => toggleSeleccionFusion(g.id)}
                            className={`w-full py-1 px-2 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                              seleccionadosFusion.includes(g.id)
                                ? 'bg-primary/15 border-primary text-primary font-semibold'
                                : 'bg-muted/30 hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            {seleccionadosFusion.includes(g.id)
                              ? '☑ Seleccionado para fusión múltiple'
                              : '☐ Añadir a fusión múltiple'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Paginación Interna */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>
              Mostrando {gruposPaginados.length} de {gruposFiltrados.length} grupos
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
