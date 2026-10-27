import { Card, CardContent } from '@/components/ui/card'
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
  FileText,
  Eye,
  Check,
  ArrowLeftRight,
  Plus,
  Scissors,
  Calendar,
  Tag,
  Copy,
  X,
  ArrowLeft,
  ArrowRight,
  Undo2,
  AlertTriangle,
} from 'lucide-react'
import { GrupoDecisionCardProps } from './GrupoDecisionCard.types'
import { getPaginaThumbnailUrl } from '../../services/upload.service'

const ANIOS_RAPIDOS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]

export function GrupoDecisionCard({
  grupo,
  indexReal,
  decision,
  tiposExistentes,
  nombresEnEsteLote = [],
  puedeCopiarAlSiguiente = false,
  puedeVincularConSiguiente = false,
  siguienteNumeroGrupo,
  todosLosGrupos = [],
  itemPortapapeles,
  onAceptarSugerido,
  onCambiarAOtroTipo,
  onCambiarANuevoTipo,
  onSeleccionarTipoExistente,
  onTextoNuevoTipo,
  onAplicarNombre,
  onAnexarAnio,
  onCopiarAlSiguiente,
  onCambiarModoEstructura,
  onInvertirCaras,
  onAnexarSiguientePagina,
  onVincularReversoConSiguiente,
  onRemoverPagina,
  onMoverPagina,
  onAbrirSelectorMoverPagina,
  onAbrirSelectorTraerPagina,
  onAbrirSelectorFusionarGrupo,
  onTomarPaginaEnPortapapeles,
  onPegarPaginaDesdePortapapeles,
  onDesanexarUltimaPagina,
  onSepararGrupo,
  onVerTodasPaginas,
  autoFocus = false,
}: GrupoDecisionCardProps) {
  const pags = grupo.paginas || []

  const esDosCaras = pags.length === 2
  const esMultipagina = pags.length > 2
  const modoActual = decision.modoEstructura || (esDosCaras ? 'ANVERSO_REVERSO' : esMultipagina ? 'MULTIPAGINA' : 'INDEPENDIENTE')
  const esFormatoAnversoReverso = modoActual === 'ANVERSO_REVERSO' || (esDosCaras && decision.formatoCaras === 'anverso_reverso' && decision.esDobleCara)

  // Detección de slots faltantes
  const slotsEsperados = decision.slotsEsperados || (modoActual === 'ANVERSO_REVERSO' ? 2 : pags.length)
  const faltanSlots = pags.length < slotsEsperados

  const listoParaGuardar =
    ((decision.modo === 'sugerido' && decision.confirmado) ||
      (decision.modo === 'existente' && Boolean(decision.tipoId)) ||
      (decision.modo === 'nuevo' && Boolean(decision.nombreNuevo?.trim())))

  const nombresSugeridosDisponibles = nombresEnEsteLote.filter(
    (n) => n && n !== decision.nombreNuevo?.trim()
  )

  // Otros grupos disponibles para transferir páginas (Push & Pull)
  const otrosGrupos = (todosLosGrupos || []).filter((g) => g.id !== grupo.id)

  return (
    <Card
      className={`border transition-all shadow-sm ${
        listoParaGuardar && !faltanSlots
          ? 'border-green-500/50 bg-green-500/[0.02]'
          : faltanSlots
            ? 'border-amber-500/50 bg-amber-500/[0.02]'
            : 'border-border/90 hover:border-primary/50'
      }`}
    >
      <CardContent className="p-5 space-y-4">
        {/* Cabecera del Grupo con Badges Semánticos */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 font-semibold">
              Grupo #{indexReal}
            </Badge>

            <span className="text-sm font-semibold">
              {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
            </span>

            {/* Badges de Modo Estructural y Slots (Punto A) */}
            {modoActual === 'ANVERSO_REVERSO' && (
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs font-medium"
              >
                🔵 Anverso / 🟣 Reverso
              </Badge>
            )}

            {modoActual === 'MULTIPAGINA' && (
              <Badge
                variant="outline"
                className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-xs font-medium"
              >
                📑 Multipágina ({pags.length} slots)
              </Badge>
            )}

            {modoActual === 'INDEPENDIENTE' && pags.length === 1 && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs font-medium"
              >
                📄 1 Hoja
              </Badge>
            )}

            {/* Alertas de Slots y Origen (Punto B, C, D) */}
            {faltanSlots && (
              <Badge
                variant="outline"
                className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs gap-1 font-medium"
              >
                <AlertTriangle className="h-3 w-3" />
                {modoActual === 'ANVERSO_REVERSO' ? 'Falta Reverso' : `Faltan ${slotsEsperados - pags.length} slot(s)`}
              </Badge>
            )}

            {decision.alertaOrigenMixto && (
              <Badge
                variant="outline"
                className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs gap-1 font-medium"
              >
                ⚠️ Origen mixto (PDFs distintos)
              </Badge>
            )}

            {listoParaGuardar ? (
              <Badge
                variant="secondary"
                className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 text-xs gap-1 font-medium"
              >
                <Check className="h-3 w-3 text-green-600" /> Listo para guardar
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs"
              >
                Pendiente de nombrar
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {puedeCopiarAlSiguiente && onCopiarAlSiguiente && listoParaGuardar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCopiarAlSiguiente(grupo.id)}
                className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                title={`Copiar este nombre al Grupo #${siguienteNumeroGrupo || indexReal + 1}`}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar a Grupo #{siguienteNumeroGrupo || indexReal + 1}
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onVerTodasPaginas(grupo)}
              className="text-xs gap-1.5 text-primary hover:text-primary/80 h-8"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver páginas ({pags.length})
            </Button>
          </div>
        </div>

        {/* Selector de Modo de Estructura (Punto A) */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-muted/40 rounded-lg border text-xs flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground pl-1">
            Modo de Estructura:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onCambiarModoEstructura?.(grupo.id, 'INDEPENDIENTE')}
              className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                modoActual === 'INDEPENDIENTE'
                  ? 'bg-background shadow-xs text-foreground font-semibold border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📄 1 Página
            </button>
            <button
              type="button"
              onClick={() => onCambiarModoEstructura?.(grupo.id, 'ANVERSO_REVERSO')}
              className={`px-2 py-0.5 rounded text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                modoActual === 'ANVERSO_REVERSO'
                  ? 'bg-background shadow-xs text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🔵🟣 Anverso / Reverso</span>
            </button>
            <button
              type="button"
              onClick={() => onCambiarModoEstructura?.(grupo.id, 'MULTIPAGINA')}
              className={`px-2 py-0.5 rounded text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                modoActual === 'MULTIPAGINA'
                  ? 'bg-background shadow-xs text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>📑 Multipágina</span>
            </button>
          </div>
        </div>

        {/* Contenido: Galería de Páginas + Asignación de Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Miniaturas de muestra con etiquetas y acciones individuales */}
          <div className="md:col-span-5 flex flex-col gap-2.5">
            {/* Banner de Pegar desde Portapapeles Flotante */}
            {itemPortapapeles && itemPortapapeles.grupoOrigenId !== grupo.id && (
              <div className="flex items-center justify-between gap-2 p-2 bg-primary/10 border-2 border-dashed border-primary/40 rounded-lg text-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Scissors className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate text-[11px]">
                    Pegar <strong>Pág. {itemPortapapeles.pagina.nroPaginaEnPdf}</strong> (del Grupo #{itemPortapapeles.numeroGrupoOrigenVisible})
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => onPegarPaginaDesdePortapapeles?.(grupo.id, undefined)}
                    className="h-6 text-[10px] px-2 font-medium"
                  >
                    + Pág. {pags.length + 1}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onPegarPaginaDesdePortapapeles?.(grupo.id, 'Reverso')}
                    className="h-6 text-[10px] px-2 font-medium text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  >
                    🟣 Reverso
                  </Button>
                </div>
              </div>
            )}

            {/* Fila de miniaturas de páginas con scroll horizontal */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1">
              {pags.map((p, pIdx) => {
                const slotAsignado = decision.slotsPaginas?.[p.id]
                let slotDefault = `PÁG. ${pIdx + 1}`
                if (esFormatoAnversoReverso) {
                  slotDefault = pIdx === 0 ? 'ANVERSO' : 'REVERSO'
                }
                const slotMostrado = (slotAsignado || slotDefault).toUpperCase()
                const esAnverso = slotMostrado.includes('ANVERSO')
                const esReverso = slotMostrado.includes('REVERSO')

                return (
                  <div
                    key={p.id}
                    className={`relative w-36 shrink-0 bg-muted/30 rounded-lg border flex flex-col justify-between p-2 hover:shadow-md transition-all group/thumb ${
                      esAnverso
                        ? 'border-blue-500/50 ring-1 ring-blue-500/30'
                        : esReverso
                          ? 'border-purple-500/50 ring-1 ring-purple-500/30'
                          : 'border-border/80 hover:border-primary'
                    }`}
                  >
                    {/* Botón para quitar esta página específica */}
                    {pags.length > 1 && onRemoverPagina && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoverPagina(grupo.id, p.id)
                        }}
                        className="absolute top-1 right-1 z-20 h-5 w-5 rounded-full bg-destructive/90 hover:bg-destructive text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110 cursor-pointer"
                        title="Quitar esta página de este grupo (creará un grupo separado)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}

                    {/* Badge de Slot */}
                    <span
                      className={`absolute top-1 left-1 z-10 text-white font-bold text-[8px] px-1.5 py-0.5 rounded shadow tracking-wide truncate max-w-[90px] ${
                        esAnverso ? 'bg-blue-600' : esReverso ? 'bg-purple-600' : 'bg-slate-800/90'
                      }`}
                      title={slotMostrado}
                    >
                      {slotMostrado}
                    </span>

                    {/* Miniatura ampliable al click */}
                    <div
                      onClick={() => onVerTodasPaginas(grupo)}
                      className="relative w-full h-24 bg-muted/20 rounded flex items-center justify-center overflow-hidden cursor-pointer mt-5"
                    >
                      <img
                        src={getPaginaThumbnailUrl(p.id)}
                        alt={`Pág ${p.nroPaginaEnPdf}`}
                        className="w-full h-full object-cover object-top transition-transform duration-200 group-hover/thumb:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                      <FileText className="h-6 w-6 text-muted-foreground/40 absolute -z-0" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                        <Eye className="h-4 w-4 text-white drop-shadow-xs" />
                      </div>
                    </div>

                    {/* Número y PDF original */}
                    <div className="w-full text-center mt-1">
                      <span className="text-[11px] font-mono font-semibold block">
                        Pág. {p.nroPaginaEnPdf}
                      </span>
                      {p.pdfOrigen && (
                        <span
                          className="text-[9px] text-muted-foreground font-mono block truncate px-1"
                          title={`PDF Origen: ${p.pdfOrigen}`}
                        >
                          {p.pdfOrigen}
                        </span>
                      )}
                    </div>

                    {/* Controles de página: Reordenar y Push (Mover a otro grupo) */}
                    <div className="mt-1 pt-1 border-t space-y-1">
                      {pags.length > 1 && onMoverPagina && (
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={pIdx === 0}
                            onClick={() => onMoverPagina(grupo.id, pIdx, 'izquierda')}
                            className="p-1 rounded bg-muted hover:bg-muted-foreground/20 disabled:opacity-20 text-foreground cursor-pointer disabled:cursor-not-allowed flex-1 flex items-center justify-center h-5"
                            title="Mover página a la izquierda"
                          >
                            <ArrowLeft className="h-3 w-3" />
                          </button>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            #{pIdx + 1}
                          </span>
                          <button
                            type="button"
                            disabled={pIdx === pags.length - 1}
                            onClick={() => onMoverPagina(grupo.id, pIdx, 'derecha')}
                            className="p-1 rounded bg-muted hover:bg-muted-foreground/20 disabled:opacity-20 text-foreground cursor-pointer disabled:cursor-not-allowed flex-1 flex items-center justify-center h-5"
                            title="Mover página a la derecha"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Push: Botones interactivos para Mover o Cortar/Tomar */}
                      {otrosGrupos.length > 0 && (
                        <div className="flex flex-col gap-1 pt-0.5">
                          {onAbrirSelectorMoverPagina && (
                            <button
                              type="button"
                              onClick={() => onAbrirSelectorMoverPagina(p, grupo.id)}
                              className="w-full text-[9px] py-0.5 px-1 rounded bg-background border border-border hover:border-primary text-primary font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Buscar y mover esta página a otro grupo"
                            >
                              <span>➡️</span>
                              <span className="truncate">Mover a...</span>
                            </button>
                          )}
                          {onTomarPaginaEnPortapapeles && (
                            <button
                              type="button"
                              onClick={() => onTomarPaginaEnPortapapeles(p, grupo.id, indexReal)}
                              className="w-full text-[9px] py-0.5 px-1 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              title="Cortar página en portapapeles para pegarla en otro grupo con scroll"
                            >
                              <Scissors className="h-2.5 w-2.5" />
                              <span className="truncate">Cortar / Tomar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Si es Anverso/Reverso y falta el slot de Reverso, mostrar placeholder visual */}
              {esFormatoAnversoReverso && pags.length === 1 && (
                <div className="w-32 shrink-0 rounded-lg border-2 border-dashed border-purple-400/50 bg-purple-500/5 flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                    Slot 2 (Reverso)
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-1">
                    Slot vacío pendiente de anexar hoja
                  </span>
                </div>
              )}
            </div>

            {/* Acciones de vinculación: Rápido al siguiente, Pull y Fusionar (Punto E) */}
            <div className="space-y-1.5 pt-1">
              {/* Opción rápida con el siguiente */}
              {puedeVincularConSiguiente && (onAnexarSiguientePagina || onVincularReversoConSiguiente) && (
                <div className="p-2 rounded-lg bg-muted/40 border space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    ¿Unir página del Grupo #{siguienteNumeroGrupo || indexReal + 1}?
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {onAnexarSiguientePagina && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAnexarSiguientePagina(grupo.id, false)}
                        className="h-7 text-[11px] gap-1 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/40 hover:bg-blue-500/10 justify-center"
                      >
                        <Plus className="h-3 w-3 text-blue-600" />
                        <span>+ Como Pág. {pags.length + 1}</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onAnexarSiguientePagina
                          ? onAnexarSiguientePagina(grupo.id, true)
                          : onVincularReversoConSiguiente?.(grupo.id)
                      }
                      className="h-7 text-[11px] gap-1 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600/40 hover:bg-purple-500/10 justify-center"
                    >
                      <Plus className="h-3 w-3 text-purple-600" />
                      <span>+ Como Lado B</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Traer página o fusionar grupo desde cualquier otro grupo */}
              {otrosGrupos.length > 0 && (
                <div className="p-2 rounded-lg bg-muted/20 border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Traer o fusionar desde otro grupo:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {onAbrirSelectorTraerPagina && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAbrirSelectorTraerPagina(grupo.id)}
                        className="h-7 text-[10px] bg-background justify-start gap-1.5 font-normal text-muted-foreground hover:text-foreground truncate"
                        title="Buscar y seleccionar una página de cualquier otro grupo"
                      >
                        <span>📥</span>
                        <span className="truncate">Traer página de...</span>
                      </Button>
                    )}

                    {onAbrirSelectorFusionarGrupo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAbrirSelectorFusionarGrupo(grupo.id)}
                        className="h-7 text-[10px] bg-background justify-start gap-1.5 font-normal text-muted-foreground hover:text-foreground truncate"
                        title="Buscar y fusionar todas las páginas de otro grupo en este"
                      >
                        <span>🔄</span>
                        <span className="truncate">Fusionar grupo aquí...</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Acciones para grupos con 2 o más páginas */}
              {pags.length >= 2 && (
                <div className="flex items-center gap-2 pt-0.5">
                  {onInvertirCaras && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onInvertirCaras(grupo.id)}
                      className="h-6 text-[11px] gap-1 border-dashed hover:border-primary text-foreground flex-1"
                      title="Intercambiar el orden de las páginas principales"
                    >
                      <ArrowLeftRight className="h-3 w-3 text-primary" />
                      Invertir lados
                    </Button>
                  )}

                  {onDesanexarUltimaPagina && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDesanexarUltimaPagina(grupo.id)}
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground flex-1"
                      title="Desanexar la última página de este grupo para devolverla a su propia tarjeta"
                    >
                      <Undo2 className="h-3 w-3" />
                      Desanexar
                    </Button>
                  )}

                  {onSepararGrupo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSepararGrupo(grupo.id)}
                      className="h-6 text-[11px] gap-1 text-destructive hover:bg-destructive/10 border-destructive/30 flex-1"
                      title="Desarmar este grupo y dejar cada página como documento individual"
                    >
                      <Scissors className="h-3 w-3" />
                      Separar todo
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel de decisión de Tipo Documental */}
          <div className="md:col-span-7 space-y-3">
            {decision.modo === 'sugerido' && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sugerencia del Clasificador
                  </span>
                  <Badge variant="secondary" className="font-semibold text-xs text-primary">
                    {grupo.tipoDocumentoSugerido?.nombre || 'Tipo Sugerido'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAceptarSugerido(grupo.id)}
                    className="flex-1 h-9 gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    Confirmar como {grupo.tipoDocumentoSugerido?.nombre}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCambiarANuevoTipo(grupo.id)}
                    className="h-9 text-xs"
                  >
                    Escribir otro nombre
                  </Button>
                </div>
              </div>
            )}

            {decision.modo === 'existente' && (
              <div className="p-4 rounded-xl border space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Elegir Tipo Existente
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCambiarANuevoTipo(grupo.id)}
                    className="h-7 text-xs text-primary"
                  >
                    Escribir nombre nuevo
                  </Button>
                </div>

                <Select
                  value={decision.tipoId ? String(decision.tipoId) : ''}
                  onValueChange={(val) => onSeleccionarTipoExistente(grupo.id, val)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Selecciona el tipo de documento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposExistentes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {decision.modo === 'nuevo' && (
              <div className="p-4 rounded-xl border space-y-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      ¿Cómo se llama este documento? (Punto A)
                    </span>
                  </div>
                  {tiposExistentes.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCambiarAOtroTipo(grupo.id)}
                      className="h-7 text-xs"
                    >
                      Elegir de lista existente
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id={`input-nombre-tipo-${grupo.id}`}
                      list="tipos-lote-list"
                      placeholder="EJ: CERTIFICADO DE NOTAS, TITULO PROF., RESOLUCION..."
                      value={decision.nombreNuevo || ''}
                      onChange={(e) => onTextoNuevoTipo(grupo.id, e.target.value)}
                      className="h-10 text-sm font-semibold tracking-wide uppercase border-primary/40 focus-visible:ring-primary bg-background shadow-inner"
                      autoFocus={autoFocus}
                    />
                    {decision.nombreNuevo?.trim() ? (
                      <Badge className="bg-green-600 text-white shrink-0 h-10 px-3 gap-1 text-xs font-medium">
                        <Check className="h-3.5 w-3.5" /> Asignado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-600 dark:text-amber-400 shrink-0 h-10 px-2.5 text-xs"
                      >
                        Ingresa el nombre
                      </Badge>
                    )}
                  </div>

                  {/* Chips de nombres usados en este lote */}
                  {nombresSugeridosDisponibles.length > 0 && onAplicarNombre && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3 text-primary" />
                        Usados en este lote:
                      </span>
                      {nombresSugeridosDisponibles.map((nom) => (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => onAplicarNombre(grupo.id, nom)}
                          className="px-2 py-0.5 text-xs font-semibold rounded-md bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/20 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                          title={`Asignar nombre "${nom}" a este grupo`}
                        >
                          <span>+</span> {nom}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Chips rápidos de años */}
                  {onAnexarAnio && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        Añadir año:
                      </span>
                      {ANIOS_RAPIDOS.map((anio) => (
                        <button
                          key={anio}
                          type="button"
                          onClick={() => onAnexarAnio(grupo.id, anio)}
                          className="px-2 py-0.5 text-xs font-mono font-semibold rounded-md bg-muted hover:bg-primary/15 hover:text-primary border transition-colors cursor-pointer"
                          title={`Añadir o actualizar año ${anio}`}
                        >
                          {anio}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    💡 Solo mayúsculas. Solo se permiten letras, números, puntos para abreviaciones y espacios.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
