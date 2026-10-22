import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  PlusCircle,
  Check,
  ArrowLeftRight,
  Plus,
  Scissors,
  Calendar,
  Tag,
  Copy,
  Undo2,
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
  onAceptarSugerido,
  onCambiarAOtroTipo,
  onCambiarANuevoTipo,
  onSeleccionarTipoExistente,
  onTextoNuevoTipo,
  onAplicarNombre,
  onAnexarAnio,
  onCopiarAlSiguiente,
  onToggleDobleCara,
  onCambiarFormatoCaras,
  onInvertirCaras,
  onAnexarSiguientePagina,
  onVincularReversoConSiguiente,
  onDesanexarUltimaPagina,
  onSepararGrupo,
  onVerTodasPaginas,
  autoFocus = false,
}: GrupoDecisionCardProps) {
  const pags = grupo.paginas || []
  const primeraPagina = pags[0]
  const textoMuestra = (primeraPagina?.textoOcr || '').trim().slice(0, 220)

  const esDosCaras = pags.length === 2
  const esMultipagina = pags.length > 2
  const esFormatoAnversoReverso =
    esDosCaras && (decision.formatoCaras === 'anverso_reverso' || decision.esDobleCara)

  const listoParaGuardar =
    (decision.modo === 'sugerido' && decision.confirmado) ||
    (decision.modo === 'existente' && Boolean(decision.tipoId)) ||
    (decision.modo === 'nuevo' && Boolean(decision.nombreNuevo?.trim()))

  const nombresSugeridosDisponibles = nombresEnEsteLote.filter(
    (n) => n && n !== decision.nombreNuevo?.trim()
  )

  return (
    <Card
      className={`border transition-all shadow-sm ${
        listoParaGuardar
          ? 'border-green-500/50 bg-green-500/[0.02]'
          : 'border-border/90 hover:border-primary/50'
      }`}
    >
      <CardContent className="p-5 space-y-4">
        {/* Cabecera del Grupo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 font-semibold">
              Grupo #{indexReal}
            </Badge>

            <span className="text-sm font-semibold">
              {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
            </span>

            {esDosCaras && esFormatoAnversoReverso && (
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs font-medium"
              >
                🔵 Anverso / 🟣 Reverso
              </Badge>
            )}

            {esDosCaras && !esFormatoAnversoReverso && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs font-medium"
              >
                📑 2 Páginas Correlativas (Págs. 1 y 2)
              </Badge>
            )}

            {esMultipagina && (
              <Badge
                variant="outline"
                className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-xs font-medium"
              >
                📑 Multipágina ({pags.length} páginas: 1 a {pags.length})
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

        {/* Contenido: Muestras Visuales con Lado A/B / Páginas 1, 2, 3... + Texto + Acciones */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Miniaturas de muestra con etiquetas claras */}
          <div className="md:col-span-4 flex flex-col gap-2.5">
            {/* Si tiene exactamente 2 páginas, permitir alternar entre Anverso/Reverso o Páginas 1 y 2 */}
            {esDosCaras && onCambiarFormatoCaras && (
              <div className="flex items-center justify-between gap-1 p-1 bg-muted/60 rounded-md text-[11px] border">
                <span className="text-[10px] text-muted-foreground font-medium pl-1">Formato:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCambiarFormatoCaras(grupo.id, 'anverso_reverso')}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                      esFormatoAnversoReverso
                        ? 'bg-background shadow-xs text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Documento de 1 hoja con anverso y reverso (Lado A y Lado B)"
                  >
                    <span>🔵🟣 Anverso / Reverso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCambiarFormatoCaras(grupo.id, 'paginas_correlativas')}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                      !esFormatoAnversoReverso
                        ? 'bg-background shadow-xs text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Documento de 2 páginas correlativas (Página 1 y Página 2)"
                  >
                    <span>📑 Páginas 1 y 2</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {pags.slice(0, 4).map((p, pIdx) => {
                const esLadoA = esDosCaras && esFormatoAnversoReverso && pIdx === 0
                const esLadoB = esDosCaras && esFormatoAnversoReverso && pIdx === 1

                return (
                  <div
                    key={p.id}
                    onClick={() => onVerTodasPaginas(grupo)}
                    className={`relative w-28 h-36 shrink-0 bg-muted/30 rounded-lg border flex flex-col justify-between p-1.5 cursor-pointer hover:shadow-md transition-all overflow-hidden group/thumb ${
                      esLadoA
                        ? 'border-blue-500/50 ring-1 ring-blue-500/30'
                        : esLadoB
                          ? 'border-purple-500/50 ring-1 ring-purple-500/30'
                          : 'border-border/80 hover:border-primary'
                    }`}
                    title={`Página ${p.nroPaginaEnPdf}: Click para ver completa`}
                  >
                    {/* Badge de Lado A / Lado B o Página 1, 2, 3... */}
                    {esLadoA && (
                      <span className="absolute top-1 left-1 z-10 bg-blue-600 text-white font-bold text-[8.5px] px-1.5 py-0.5 rounded shadow tracking-wide">
                        LADO A · ANVERSO
                      </span>
                    )}
                    {esLadoB && (
                      <span className="absolute top-1 left-1 z-10 bg-purple-600 text-white font-bold text-[8.5px] px-1.5 py-0.5 rounded shadow tracking-wide">
                        LADO B · REVERSO
                      </span>
                    )}
                    {(!esDosCaras || !esFormatoAnversoReverso) && (
                      <span className="absolute top-1 left-1 z-10 bg-slate-800/90 text-white font-bold text-[8.5px] px-1.5 py-0.5 rounded shadow tracking-wide">
                        PÁG. {pIdx + 1} DE {pags.length}
                      </span>
                    )}

                    <div className="relative w-full h-24 bg-muted/20 rounded flex items-center justify-center overflow-hidden">
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

                    <div className="w-full text-center">
                      <span className="text-[11px] font-mono font-semibold block">
                        Pág. {p.nroPaginaEnPdf}
                      </span>
                      <span className="text-[9px] text-muted-foreground line-clamp-1">
                        {p.textoOcr ? p.textoOcr.slice(0, 22) : 'Sin OCR'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Acciones de Lados y Páginas (Vincular Reverso, Anexar Pág. 2, 3, etc.) */}
            <div className="space-y-1.5 pt-1">
              {/* CASO A: Documento de 1 página: Puede vincular Reverso O Anexar Página 2 */}
              {pags.length === 1 && puedeVincularConSiguiente && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    ¿Unir con página del Grupo #{siguienteNumeroGrupo || indexReal + 1}?
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onAnexarSiguientePagina
                          ? onAnexarSiguientePagina(grupo.id, true)
                          : onVincularReversoConSiguiente?.(grupo.id)
                      }
                      className="w-full h-7 text-xs gap-1.5 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600/40 hover:bg-purple-500/10 justify-start"
                      title={`Unir la página del Grupo #${siguienteNumeroGrupo || indexReal + 1} como Reverso (Lado B) de este documento`}
                    >
                      <Plus className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span>Vincular Reverso (Lado B)</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onAnexarSiguientePagina
                          ? onAnexarSiguientePagina(grupo.id, false)
                          : onVincularReversoConSiguiente?.(grupo.id)
                      }
                      className="w-full h-7 text-xs gap-1.5 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/40 hover:bg-blue-500/10 justify-start"
                      title={`Anexar la página del Grupo #${siguienteNumeroGrupo || indexReal + 1} como Página 2 de este documento`}
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Anexar como Página 2</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO B: Documento de 2 o más páginas */}
              {pags.length >= 2 && (
                <div className="space-y-1.5">
                  {/* Botón Invertir páginas */}
                  {onInvertirCaras && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onInvertirCaras(grupo.id)}
                      className="w-full h-7 text-xs gap-1.5 border-dashed hover:border-primary text-foreground"
                      title="Intercambiar el orden de las páginas"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                      {esDosCaras && esFormatoAnversoReverso
                        ? 'Invertir Lados (A ⇄ B)'
                        : 'Invertir orden (Pág. 1 ⇄ Pág. 2)'}
                    </Button>
                  )}

                  {/* Botón Anexar Página N+1 */}
                  {puedeVincularConSiguiente && onAnexarSiguientePagina && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAnexarSiguientePagina(grupo.id, false)}
                      className="w-full h-7 text-xs gap-1.5 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/40 hover:bg-blue-500/10 justify-start"
                      title={`Anexar la página del Grupo #${siguienteNumeroGrupo || indexReal + 1} como Página ${pags.length + 1} de este documento`}
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>+ Anexar Página {pags.length + 1} (del Grupo #{siguienteNumeroGrupo || indexReal + 1})</span>
                    </Button>
                  )}

                  {/* Acciones de Quitar última página o Separar todas */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {onDesanexarUltimaPagina && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDesanexarUltimaPagina(grupo.id)}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 flex-1 px-1.5"
                        title={`Quitar la Página ${pags.length} de este grupo y devolverla como grupo separado`}
                      >
                        <Undo2 className="h-3 w-3" />
                        Quitar Pág. {pags.length}
                      </Button>
                    )}

                    {onSepararGrupo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onSepararGrupo(grupo.id)}
                        className="h-6 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 gap-1 flex-1 px-1.5"
                        title={`Dividir este grupo en ${pags.length} documentos individuales de 1 página`}
                      >
                        <Scissors className="h-3 w-3" />
                        Separar todas ({pags.length})
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Texto de muestra + Decisiones de Tipo */}
          <div className="md:col-span-8 flex flex-col justify-between space-y-3.5">
            {/* Texto OCR de muestra */}
            <div className="bg-muted/30 p-2.5 rounded-lg border text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3">
              {textoMuestra ? `"${textoMuestra}..."` : '(Páginas sin texto OCR legible)'}
            </div>

            {/* DECISIÓN A: Tipo Sugerido */}
            {decision.modo === 'sugerido' && grupo.tipoDocumentoSugerido && (
              <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/[0.03] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      El sistema detectó coincidencia con:
                    </span>
                    <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs font-semibold">
                      {grupo.tipoDocumentoSugerido.nombre}
                    </Badge>
                  </div>

                  {!decision.confirmado ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        id={`btn-confirmar-sugerido-${grupo.id}`}
                        onClick={() => onAceptarSugerido(grupo.id)}
                        className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Sí, confirmar tipo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        id={`btn-otro-tipo-${grupo.id}`}
                        onClick={() => onCambiarAOtroTipo(grupo.id)}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        No, es otro tipo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 text-xs gap-1"
                      >
                        <Check className="h-3 w-3" /> Confirmado
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onCambiarAOtroTipo(grupo.id)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cambiar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DECISIÓN B: Elegir de existentes */}
            {decision.modo === 'existente' && (
              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    Seleccionar tipo existente:
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCambiarANuevoTipo(grupo.id)}
                    className="h-7 text-xs gap-1 text-primary hover:text-primary/90"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Escribir nombre de tipo nuevo
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={decision.tipoId ? String(decision.tipoId) : ''}
                    onValueChange={(val) => onSeleccionarTipoExistente(grupo.id, val)}
                  >
                    <SelectTrigger className="h-9 text-xs flex-1">
                      <SelectValue placeholder="Elige un tipo de documento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposExistentes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {decision.tipoId && (
                    <Badge className="bg-green-600 text-white shrink-0 h-9 px-3 gap-1 text-xs">
                      <Check className="h-3.5 w-3.5" /> Asignado
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* DECISIÓN C: Tipo Nuevo (CAMPO PROMINENTE EN MAYÚSCULAS) */}
            {decision.modo === 'nuevo' && (
              <div className="p-4 rounded-xl border-2 border-primary/40 bg-primary/[0.03] space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-2.5 py-0.5">
                      ✨ Tipo Nuevo de Documento
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      ¿Cómo se llama este documento?
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

                  {/* Chips rápidos de nombres usados en este lote */}
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

                  {/* Chips rápidos de años/periodos */}
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
                    💡 Solo mayúsculas. Solo se permiten letras, números, puntos para abreviaciones
                    (ej: CERT., RES.) y espacios simples.
                  </p>
                </div>
              </div>
            )}

            {/* Checkbox de doble cara */}
            {pags.length >= 2 && (
              <div className="flex items-center justify-between pt-2 border-t mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`checkbox-doble-cara-${grupo.id}`}
                    checked={decision.esDobleCara}
                    onCheckedChange={(checked) => onToggleDobleCara(grupo.id, Boolean(checked))}
                  />
                  <label
                    htmlFor={`checkbox-doble-cara-${grupo.id}`}
                    className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                  >
                    <span>📄📄</span>
                    <span>
                      Estas páginas son del mismo documento (Lado A = Anverso, Lado B = Reverso)
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

