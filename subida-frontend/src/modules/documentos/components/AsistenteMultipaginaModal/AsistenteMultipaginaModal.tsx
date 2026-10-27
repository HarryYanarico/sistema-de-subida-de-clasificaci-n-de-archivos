import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Layers,
  ArrowUp,
  ArrowDown,
  Check,
  FileCheck2,
  Trash2,
  Plus,
} from 'lucide-react'
import { Grupo } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { getPaginaThumbnailUrl } from '../../services/upload.service'

interface AsistenteMultipaginaModalProps {
  open: boolean
  grupos: Grupo[]
  tiposExistentes: TipoDocumento[]
  onCerrar: () => void
  onCrearMultipagina: (
    grupoIdsOrdenados: number[],
    tipoId: number | null,
    nombreNuevo: string
  ) => void
}

export function AsistenteMultipaginaModal({
  open,
  grupos,
  tiposExistentes,
  onCerrar,
  onCrearMultipagina,
}: AsistenteMultipaginaModalProps) {
  // Lista de IDs de grupos seleccionados en orden de slot
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [modoTipo, setModoTipo] = useState<'existente' | 'nuevo'>('nuevo')
  const [tipoId, setTipoId] = useState<number | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState<string>('')

  // Grupos disponibles para agregar a la selección
  const gruposDisponibles = useMemo(() => {
    return grupos.filter((g) => !seleccionados.includes(g.id))
  }, [grupos, seleccionados])

  // Grupos actualmente seleccionados en el orden especificado
  const gruposOrdenados = useMemo(() => {
    return seleccionados
      .map((id) => grupos.find((g) => g.id === id))
      .filter(Boolean) as Grupo[]
  }, [seleccionados, grupos])

  // Total de páginas en los grupos seleccionados
  const totalPaginasSeleccionadas = useMemo(() => {
    return gruposOrdenados.reduce((acc, g) => acc + (g.paginas?.length || 0), 0)
  }, [gruposOrdenados])

  // Análisis de orígenes PDF de las páginas seleccionadas (Punto B & C)
  const metricasOrigen = useMemo(() => {
    const origenes = new Set<string>()
    gruposOrdenados.forEach((g) => {
      (g.paginas || []).forEach((p) => {
        if (p.pdfOrigen) origenes.add(p.pdfOrigen)
      })
    })

    const esMismoOrigen = origenes.size <= 1
    return {
      totalPdfsDistintos: origenes.size,
      esMismoOrigen,
      listaOrigenes: Array.from(origenes),
    }
  }, [gruposOrdenados])

  // Mover arriba / abajo en la secuencia de slots
  const moverGrupo = (index: number, direccion: 'arriba' | 'abajo') => {
    const destino = direccion === 'arriba' ? index - 1 : index + 1
    if (destino < 0 || destino >= seleccionados.length) return
    const copia = [...seleccionados]
    const [movido] = copia.splice(index, 1)
    copia.splice(destino, 0, movido)
    setSeleccionados(copia)
  }

  const agregarGrupo = (id: number) => {
    if (!seleccionados.includes(id)) {
      setSeleccionados((prev) => [...prev, id])
    }
  }

  const quitarGrupo = (id: number) => {
    setSeleccionados((prev) => prev.filter((gid) => gid !== id))
  }

  const puedeConfirmar =
    seleccionados.length >= 2 &&
    ((modoTipo === 'existente' && Boolean(tipoId)) ||
      (modoTipo === 'nuevo' && Boolean(nombreNuevo.trim())))

  const handleConfirmar = () => {
    if (!puedeConfirmar) return
    onCrearMultipagina(
      seleccionados,
      modoTipo === 'existente' ? tipoId : null,
      modoTipo === 'nuevo' ? nombreNuevo.trim().toUpperCase() : ''
    )
    setSeleccionados([])
    setNombreNuevo('')
    setTipoId(null)
    onCerrar()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCerrar()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-6 w-6" />
            <DialogTitle className="text-xl">Asistente: Armar Tipo Multi-Página</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Selecciona $N$ grupos para unirlos en un único documento multi-página correlativo. 
            Define la secuencia exacta de slots (Pág. 1 → Pág. 2 → ... → Pág. N) y el tipo común.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Asignación del TipoDocumento */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2.5">
            <span className="text-xs font-semibold block text-foreground">
              1. Tipo de Documento para el Conjunto (Punto A)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={modoTipo === 'nuevo' ? 'default' : 'outline'}
                onClick={() => setModoTipo('nuevo')}
                className="h-7 text-xs"
              >
                Crear nuevo tipo
              </Button>
              {tiposExistentes.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={modoTipo === 'existente' ? 'default' : 'outline'}
                  onClick={() => setModoTipo('existente')}
                  className="h-7 text-xs"
                >
                  Seleccionar existente
                </Button>
              )}
            </div>

            {modoTipo === 'nuevo' ? (
              <Input
                placeholder="EJ: EXPEDIENTE ACADÉMICO, FÓLIO DE CALIFICACIONES..."
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value.toUpperCase())}
                className="h-9 text-xs font-semibold uppercase tracking-wide bg-background"
              />
            ) : (
              <Select
                value={tipoId ? String(tipoId) : ''}
                onValueChange={(val) => setTipoId(Number(val))}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Selecciona un tipo existente..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposExistentes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Secuencia de slots ordenados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                2. Secuencia de Slots del Documento ({seleccionados.length} grupos · {totalPaginasSeleccionadas} páginas)
              </span>
              {seleccionados.length >= 2 && (
                <Badge variant="outline" className="text-[10px] text-green-700 bg-green-500/10 border-green-500/30">
                  {seleccionados.length} Slots configurados
                </Badge>
              )}
            </div>

            {seleccionados.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-xs text-muted-foreground bg-muted/20">
                No has seleccionado ningún grupo aún. Agrega grupos desde la lista inferior para armar los slots.
              </div>
            ) : (
              <div className="space-y-2">
                {gruposOrdenados.map((g, idx) => {
                  const primeraPag = (g.paginas || [])[0]
                  const numEnLote = grupos.findIndex((item) => item.id === g.id) + 1

                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:border-primary/40 transition-all gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary text-white font-mono text-xs px-2 h-6 flex items-center">
                          Slot #{idx + 1} ➔ Pág. {idx + 1}
                        </Badge>

                        {/* Miniatura pequeña */}
                        {primeraPag && (
                          <div className="w-9 h-11 bg-muted rounded overflow-hidden border shrink-0">
                            <img
                              src={getPaginaThumbnailUrl(primeraPag.id)}
                              alt=""
                              className="w-full h-full object-cover object-top"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">
                              Grupo #{numEnLote}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              ({g.paginas?.length || 1} pág.)
                            </span>
                          </div>
                          {primeraPag?.pdfOrigen && (
                            <span className="text-[10px] text-muted-foreground font-mono block truncate max-w-xs">
                              {primeraPag.pdfOrigen}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0}
                          onClick={() => moverGrupo(idx, 'arriba')}
                          className="h-7 w-7 p-0"
                          title="Subir a slot anterior"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === seleccionados.length - 1}
                          onClick={() => moverGrupo(idx, 'abajo')}
                          className="h-7 w-7 p-0"
                          title="Bajar a slot siguiente"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => quitarGrupo(g.id)}
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          title="Quitar de este documento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Métrica de coherencia y orígenes (Punto B & C) */}
          {seleccionados.length >= 2 && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <FileCheck2 className="h-4 w-4" />
                <span>Métricas de Validación de Slots (Punto B):</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                {metricasOrigen.esMismoOrigen ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Coherencia completa: Todos los {seleccionados.length} slots provienen del mismo archivo PDF original.
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Origen mixto: Los slots provienen de {metricasOrigen.totalPdfsDistintos} PDFs distintos ({metricasOrigen.listaOrigenes.join(', ')}).
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Lista de grupos disponibles para añadir */}
          {gruposDisponibles.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <span className="text-xs font-semibold text-muted-foreground block">
                3. Grupos disponibles del lote para añadir como slot:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                {gruposDisponibles.map((g) => {
                  const numReal = grupos.findIndex((item) => item.id === g.id) + 1
                  const primera = (g.paginas || [])[0]

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => agregarGrupo(g.id)}
                      className="p-2 rounded-md border bg-card hover:bg-primary/5 hover:border-primary/50 text-left flex items-center gap-2 transition-all cursor-pointer shadow-xs group"
                    >
                      <Plus className="h-3.5 w-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="overflow-hidden">
                        <span className="text-xs font-semibold block truncate">
                          Grupo #{numReal} ({g.paginas?.length || 1} p.)
                        </span>
                        {primera?.pdfOrigen && (
                          <span className="text-[9px] text-muted-foreground block truncate">
                            {primera.pdfOrigen}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!puedeConfirmar}
            onClick={handleConfirmar}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            Consolidar en Documento Multi-Página ({seleccionados.length} slots)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
