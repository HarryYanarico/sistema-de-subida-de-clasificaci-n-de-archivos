import { useState, useRef, useEffect } from 'react'
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
  Scissors,
  Calendar,
  X,
  Plus,
  Undo2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Link2,
  MoreHorizontal,
  GitMerge,
  FolderInput,
  SlidersHorizontal,
} from 'lucide-react'
import { GrupoDecisionCardProps } from './GrupoDecisionCard.types'
import {
  getPaginaThumbnailUrl,
  formatearOrigenPagina,
} from '../../services/upload.service'

const ANIOS_RAPIDOS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]

export function GrupoDecisionCard({
  grupo,
  indexReal,
  decision,
  tiposExistentes,
  esNombreDuplicado = false,
  esGrupoDescartadas = false,
  colapsadoPorDefecto = false,
  densidad = 'comoda',
  todosLosGrupos = [],
  itemPortapapeles,
  onAceptarSugerido,
  onCambiarAOtroTipo,
  onCambiarANuevoTipo,
  onSeleccionarTipoExistente,
  onTextoNuevoTipo,
  onAnexarAnio,
  onCambiarModoEstructura,
  onInvertirCaras,
  onRemoverPagina,
  onDescartarPagina,
  onAbrirSelectorTraerPagina,
  onAbrirSelectorFusionarGrupo,
  onPegarPaginaDesdePortapapeles,
  onDesconcatenarUltimoGrupo,
  onDesanexarUltimaPagina,
  onSepararGrupo,
  onVerTodasPaginas,
  autoFocus = false,
}: GrupoDecisionCardProps) {
  const esDescartadas = esGrupoDescartadas || grupo.estado === 'descartadas'
  const [colapsado, setColapsado] = useState<boolean>(colapsadoPorDefecto || esDescartadas)

  // Divulgación progresiva: Opciones secundarias y menú contextual (...)
  const [mostrarOpcionesAvanzadas, setMostrarOpcionesAvanzadas] = useState<boolean>(false)
  const [menuAbierto, setMenuAbierto] = useState<boolean>(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAbierto) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuAbierto])

  const pags = grupo.paginas || []

  // Por defecto todo grupo inicia como INDEPENDIENTE (páginas similares agrupadas, NO concatenadas)
  const modoActual = decision.modoEstructura || 'INDEPENDIENTE'
  const estaConcatenadoPorUsuario = modoActual !== 'INDEPENDIENTE'
  const esModoSecuencial = modoActual === 'SECUENCIAL'
  const esFormatoAnversoReverso = modoActual === 'ANVERSO_REVERSO'

  // Agrupación de páginas por bloque de rol (Página 1, Página 2, etc.) cuando el grupo fue concatenado
  const bloquesConcatenados = (() => {
    if (!estaConcatenadoPorUsuario) return []
    const mapa = new Map<number, typeof pags>()
    pags.forEach((p) => {
      const ord = decision.ordenPaginas?.[p.id] || 1
      const lista = mapa.get(ord) || []
      lista.push(p)
      mapa.set(ord, lista)
    })
    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([orden, paginasBloque]) => ({
        orden,
        titulo:
          esFormatoAnversoReverso && mapa.size <= 2
            ? orden === 1
              ? 'Página 1 (Anverso)'
              : 'Página 2 (Reverso)'
            : `Página ${orden}`,
        badge: `PÁGINA ${orden}`,
        paginas: paginasBloque,
      }))
  })()

  // Detección de bloques faltantes (si el usuario activó concatenación pero aún solo hay 1 bloque)
  const slotsEsperados = estaConcatenadoPorUsuario
    ? Math.max(2, decision.slotsEsperados || bloquesConcatenados.length)
    : 1
  const faltanSlots = estaConcatenadoPorUsuario && bloquesConcatenados.length < 2

  const tieneNombreAsignado =
    (decision.modo === 'sugerido' && decision.confirmado) ||
    (decision.modo === 'existente' && Boolean(decision.tipoId)) ||
    (decision.modo === 'nuevo' && Boolean(decision.nombreNuevo?.trim()))

  const listoParaGuardar = (tieneNombreAsignado || esDescartadas) && !esNombreDuplicado

  // Etiqueta de origen principal (pdf_XX.pdf, pág N)
  const primeraPagina = pags[0]
  const etiquetaOrigenPrincipal = primeraPagina
    ? formatearOrigenPagina(primeraPagina.pdfOrigen, primeraPagina.nroPaginaEnPdf)
    : ''

  // Otros grupos disponibles para transferir páginas o concatenar
  const otrosGrupos = (todosLosGrupos || []).filter(
    (g) => g.id !== grupo.id && g.estado !== 'descartadas'
  )

  // En vista por defecto (sin concatenar), mostrar solo hasta 3 miniaturas de muestra
  const paginasMuestra = estaConcatenadoPorUsuario ? pags : pags.slice(0, 3)
  const paginasRestantesMuestra = Math.max(0, pags.length - paginasMuestra.length)

  // VISTA COMPACTA (Control de densidad: fila de alta velocidad para lotes extensos)
  if (densidad === 'compacta' && !colapsado && !estaConcatenadoPorUsuario) {
    return (
      <Card
        className={`border transition-colors shadow-2xs ${
          esNombreDuplicado
            ? 'border-destructive/60 bg-destructive/[0.02]'
            : listoParaGuardar
              ? 'border-green-500/40 bg-green-500/[0.015]'
              : 'border-border/80 hover:border-primary/40'
        }`}
      >
        <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Bloque 1: Identificador + Miniatura compacta + Metadatos (Pares Etiqueta-Valor) */}
          <div className="flex items-center gap-3.5 min-w-0 sm:w-5/12">
            {primeraPagina && (
              <div
                onClick={() => onVerTodasPaginas(grupo)}
                className="relative w-12 h-16 shrink-0 rounded-md border bg-muted/30 overflow-hidden cursor-pointer group/mini"
                title="Ver todas las páginas del grupo"
              >
                <img
                  src={getPaginaThumbnailUrl(primeraPagina.id)}
                  alt={etiquetaOrigenPrincipal}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/mini:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            )}

            <div className="min-w-0 space-y-0.5">
              {/* Nivel 1 Tipográfico: Título */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {esDescartadas ? 'Descartadas' : `Grupo #${indexReal}`}
                </span>
                <span className="text-xs font-semibold text-foreground/80">
                  · {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
                </span>
              </div>
              {/* Nivel 2 Tipográfico: Subtítulo atenuado */}
              <div className="text-xs font-normal text-muted-foreground truncate">
                Origen: <span className="font-medium text-foreground/80">{etiquetaOrigenPrincipal || '—'}</span>
              </div>
            </div>
          </div>

          {/* Bloque 2: Campo primario de asignación */}
          <div className="flex-1 flex items-center gap-2">
            {decision.modo === 'existente' ? (
              <Select
                value={decision.tipoId ? String(decision.tipoId) : ''}
                onValueChange={(val) => onSeleccionarTipoExistente(grupo.id, val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background flex-1">
                  <SelectValue placeholder="Selecciona tipo existente..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposExistentes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`input-nombre-tipo-${grupo.id}`}
                placeholder={
                  esDescartadas
                    ? 'OPCIONAL: SIN TIPO ASIGNADO...'
                    : 'NOMBRE DEL TIPO DE DOCUMENTO...'
                }
                value={decision.nombreNuevo || ''}
                onChange={(e) => onTextoNuevoTipo(grupo.id, e.target.value)}
                className={`h-9 text-xs font-semibold uppercase bg-background flex-1 ${
                  esNombreDuplicado
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'border-border focus-visible:ring-primary'
                }`}
              />
            )}

            {/* Estado reservado para color semántico */}
            {esNombreDuplicado ? (
              <Badge variant="destructive" className="text-[11px] shrink-0 gap-1">
                <AlertTriangle className="h-3 w-3" /> Duplicado
              </Badge>
            ) : tieneNombreAsignado ? (
              <Badge className="bg-green-600 text-white text-[11px] shrink-0 gap-1">
                <Check className="h-3 w-3" /> Listo
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[11px] shrink-0"
              >
                {esDescartadas ? 'Opcional' : 'Pendiente'}
              </Badge>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onVerTodasPaginas(grupo)}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
              title="Ver todas las páginas del grupo"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Páginas</span>
            </Button>

            {!esDescartadas && otrosGrupos.length > 0 && onAbrirSelectorFusionarGrupo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAbrirSelectorFusionarGrupo(grupo.id)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                title="Concatenar con otro grupo..."
              >
                <GitMerge className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={`border transition-all shadow-xs ${
        esNombreDuplicado
          ? 'border-destructive/70 bg-destructive/[0.02]'
          : esDescartadas
            ? 'border-amber-500/30 bg-amber-500/[0.02]'
            : listoParaGuardar && !faltanSlots
              ? 'border-green-500/45 bg-green-500/[0.015]'
              : faltanSlots
                ? 'border-amber-500/50 bg-amber-500/[0.02]'
                : 'border-border/80 hover:border-primary/40'
      }`}
    >
      <CardContent className="p-6 space-y-5">
        {/* CABECERA ESCANEABLE (Patrón F/Z: 3 niveles tipográficos, contraste de peso antes que color) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Nivel 1: Título del bloque */}
            <div className="flex items-center gap-2">
              {esDescartadas && <Trash2 className="h-4 w-4 text-amber-600" />}
              <h3 className="text-base font-bold tracking-tight text-foreground">
                {esDescartadas ? 'Grupo: Descartadas' : `Grupo #${indexReal}`}
              </h3>
            </div>

            {/* Pares Etiqueta-Valor con contraste tipográfico (sin saturar de badges de colores) */}
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="font-normal text-muted-foreground">Similares: </span>
                <span className="font-semibold text-foreground">
                  {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
                </span>
              </div>

              {etiquetaOrigenPrincipal && (
                <div className="hidden sm:block">
                  <span className="font-normal text-muted-foreground">Muestra: </span>
                  <span className="font-mono font-semibold text-foreground">
                    {etiquetaOrigenPrincipal}
                  </span>
                </div>
              )}

              {estaConcatenadoPorUsuario && (
                <div>
                  <span className="font-normal text-muted-foreground">Concatenación: </span>
                  <span className="font-semibold text-foreground">
                    {modoActual === 'ANVERSO_REVERSO'
                      ? 'Doble cara (Anverso / Reverso)'
                      : modoActual === 'MIXTA'
                        ? 'Mixta'
                        : 'Secuencial'}
                  </span>
                </div>
              )}
            </div>

            {/* Color reservado exclusivamente para estados críticos o de completitud */}
            {esNombreDuplicado ? (
              <Badge variant="destructive" className="text-xs gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" /> Nombre duplicado
              </Badge>
            ) : faltanSlots && !esDescartadas ? (
              <Badge
                variant="outline"
                className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs gap-1 font-medium"
              >
                <AlertTriangle className="h-3 w-3" />
                {modoActual === 'ANVERSO_REVERSO'
                  ? 'Falta Reverso'
                  : `Faltan ${slotsEsperados - pags.length} página(s)`}
              </Badge>
            ) : tieneNombreAsignado ? (
              <Badge
                variant="secondary"
                className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 text-xs gap-1 font-medium"
              >
                <Check className="h-3 w-3 text-green-600" /> Listo
              </Badge>
            ) : esDescartadas ? (
              <span className="text-xs font-normal text-muted-foreground">
                Sin tipo asignado (opcional)
              </span>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs font-medium"
              >
                Pendiente de nombrar
              </Badge>
            )}
          </div>

          {/* Acciones Secundarias y Menú Contextual (... / Kebab Menu — Ley de Hick) */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onVerTodasPaginas(grupo)}
              className="text-xs gap-1.5 h-8 font-medium"
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              Ver todas las páginas ({pags.length})
            </Button>

            {esDescartadas ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColapsado((prev) => !prev)}
                className="text-xs h-8 gap-1"
              >
                {colapsado ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" /> Expandir
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Colapsar
                  </>
                )}
              </Button>
            ) : (
              /* Menú Contextual (...) para agrupar acciones secundarias e infrecuentes */
              <div className="relative" ref={menuRef}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuAbierto((prev) => !prev)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Más acciones del grupo"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {menuAbierto && (
                  <div className="absolute right-0 mt-1.5 w-60 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones de concatenación
                    </div>

                    {otrosGrupos.length > 0 && onAbrirSelectorFusionarGrupo && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false)
                          onAbrirSelectorFusionarGrupo(grupo.id)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <GitMerge className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Concatenar con otro grupo...</span>
                      </button>
                    )}

                    {otrosGrupos.length > 0 && onAbrirSelectorTraerPagina && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false)
                          onAbrirSelectorTraerPagina(grupo.id)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <FolderInput className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Traer página de otro grupo...</span>
                      </button>
                    )}

                    {pags.length >= 2 && !estaConcatenadoPorUsuario && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false)
                          onCambiarModoEstructura?.(grupo.id, 'SECUENCIAL')
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Definir concatenación interna</span>
                      </button>
                    )}

                    {estaConcatenadoPorUsuario && (
                      <>
                        {pags.length >= 2 && onInvertirCaras && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuAbierto(false)
                              onInvertirCaras(grupo.id)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>Invertir orden de páginas</span>
                          </button>
                        )}

                        {pags.length >= 2 && onDesanexarUltimaPagina && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuAbierto(false)
                              onDesanexarUltimaPagina(grupo.id)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                          >
                            <Undo2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>Desanexar última página</span>
                          </button>
                        )}

                        {pags.length >= 2 && onSepararGrupo && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuAbierto(false)
                              onSepararGrupo(grupo.id)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-destructive/10 text-destructive text-left transition-colors cursor-pointer"
                          >
                            <Scissors className="h-3.5 w-3.5 shrink-0" />
                            <span>Separar en grupos individuales</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setMenuAbierto(false)
                            onCambiarModoEstructura?.(grupo.id, 'INDEPENDIENTE')
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-left transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          <span>Quitar concatenación interna</span>
                        </button>
                      </>
                    )}

                    <div className="my-1 border-t border-border/60" />
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Opciones de formulario
                    </div>

                    {tiposExistentes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false)
                          if (decision.modo === 'existente') {
                            onCambiarANuevoTipo(grupo.id)
                          } else {
                            onCambiarAOtroTipo(grupo.id)
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {decision.modo === 'existente'
                            ? 'Escribir un nombre nuevo'
                            : 'Elegir de tipos existentes'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMenuAbierto(false)
                        setMostrarOpcionesAvanzadas((prev) => !prev)
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>
                        {mostrarOpcionesAvanzadas
                          ? 'Ocultar opciones avanzadas'
                          : 'Mostrar opciones avanzadas'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {colapsado ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/25 px-4 py-3 rounded-xl">
            <span>
              Contiene <strong className="font-semibold text-foreground">{pags.length}</strong>{' '}
              página(s) descartada(s). Puedes dejarlas sin tipo o expandir para asignarles un tipo de documento.
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setColapsado(false)}
              className="h-auto p-0 text-xs font-semibold"
            >
              Expandir sección
            </Button>
          </div>
        ) : (
          /* CHUNKING EN 2 BLOQUES LÓGICOS DELIMITADOS POR ESPACIADO NEGATIVO (Ley de Miller y Gestalt) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* BLOQUE LÓGICO 1 (Izquierda, 5 cols): Muestra visual de páginas similares */}
            <div className="lg:col-span-5 rounded-xl bg-muted/20 p-4 flex flex-col justify-between gap-3">
              {/* Banner de Pegar desde Portapapeles Flotante */}
              {itemPortapapeles && itemPortapapeles.grupoOrigenId !== grupo.id && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-primary/10 border border-dashed border-primary/40 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Scissors className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate text-xs">
                      Pegar <strong>Pág. {itemPortapapeles.pagina.nroPaginaEnPdf}</strong> (Grupo #{itemPortapapeles.numeroGrupoOrigenVisible})
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => onPegarPaginaDesdePortapapeles?.(grupo.id, undefined)}
                    className="h-6 text-[11px] px-2.5 font-medium shrink-0"
                  >
                    Pegar aquí
                  </Button>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Nivel 2 Tipográfico: Label de sección */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-normal text-muted-foreground">
                    {estaConcatenadoPorUsuario
                      ? `Orden de concatenación (${pags.length} páginas)`
                      : `Muestra visual (${Math.min(3, pags.length)} de ${pags.length} similares)`}
                  </span>
                </div>

                {!estaConcatenadoPorUsuario ? (
                  /* VISTA POR DEFECTO: Hasta 3 miniaturas de muestra limpias */
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {paginasMuestra.map((p) => {
                      const etiquetaOrigenPag = formatearOrigenPagina(
                        p.pdfOrigen,
                        p.nroPaginaEnPdf
                      )
                      return (
                        <div
                          key={p.id}
                          className="relative w-28 shrink-0 bg-background rounded-lg border border-border/70 hover:border-primary/60 flex flex-col justify-between p-2 transition-all group/thumb shadow-2xs"
                        >
                          {!esDescartadas && onDescartarPagina && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDescartarPagina(grupo.id, p.id)
                              }}
                              className="absolute top-1.5 right-1.5 z-20 h-5 w-5 rounded-full bg-background/90 hover:bg-destructive text-muted-foreground hover:text-white border flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all cursor-pointer"
                              title="Descartar esta página del grupo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}

                          <div
                            onClick={() => onVerTodasPaginas(grupo)}
                            className="relative w-full h-24 bg-muted/20 rounded flex items-center justify-center overflow-hidden cursor-pointer"
                          >
                            <img
                              src={getPaginaThumbnailUrl(p.id)}
                              alt={etiquetaOrigenPag}
                              className="w-full h-full object-cover object-top transition-transform duration-200 group-hover/thumb:scale-105"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            <FileText className="h-5 w-5 text-muted-foreground/30 absolute -z-0" />
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </div>

                          <div className="w-full text-center mt-1.5">
                            <span
                              className="text-[11px] font-mono font-medium text-foreground block truncate"
                              title={etiquetaOrigenPag}
                            >
                              {etiquetaOrigenPag}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {paginasRestantesMuestra > 0 && (
                      <button
                        type="button"
                        onClick={() => onVerTodasPaginas(grupo)}
                        className="w-24 shrink-0 rounded-lg border border-dashed border-border hover:border-primary/50 bg-background/50 hover:bg-background flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-colors"
                      >
                        <span className="text-sm font-bold text-foreground">
                          +{paginasRestantesMuestra}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground mt-0.5">
                          más
                        </span>
                      </button>
                    )}

                    {/* Botón visual (+) para agregar páginas de otros grupos como páginas similares de este grupo */}
                    {!esDescartadas && otrosGrupos.length > 0 && onAbrirSelectorTraerPagina && (
                      <button
                        type="button"
                        onClick={() => onAbrirSelectorTraerPagina(grupo.id)}
                        className="w-24 shrink-0 rounded-lg border-2 border-dashed border-primary/50 hover:border-primary bg-primary/[0.04] hover:bg-primary/[0.08] text-primary flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all shadow-2xs group/add"
                        title="Agregar páginas de otros grupos como páginas similares de este grupo"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 group-hover/add:bg-primary group-hover/add:text-primary-foreground flex items-center justify-center transition-colors shadow-2xs">
                          <Plus className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold mt-1 text-primary">
                          + Agregar
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          página
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* VISTA DE CONCATENACIÓN: bloques por rol de página (Página 1, Página 2, ...) */
                  <div className="space-y-3">
                    {/* Barra de herramientas y botones de control de concatenación */}
                    <div className="flex items-center justify-between gap-1.5 p-1.5 bg-background rounded-lg border text-xs flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onCambiarModoEstructura?.(grupo.id, 'SECUENCIAL')}
                          className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                            esModoSecuencial || modoActual === 'MULTIPAGINA'
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Por bloques (Pág. 1, Pág. 2...)
                        </button>
                        <button
                          type="button"
                          onClick={() => onCambiarModoEstructura?.(grupo.id, 'ANVERSO_REVERSO')}
                          className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                            modoActual === 'ANVERSO_REVERSO'
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Doble cara (A/R)
                        </button>
                        {bloquesConcatenados.length >= 2 && onInvertirCaras && (
                          <button
                            type="button"
                            onClick={() => onInvertirCaras(grupo.id)}
                            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer"
                            title="Intercambiar orden de los bloques de páginas (ej. Página 1 ↔ Página 2)"
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            <span>Invertir bloques</span>
                          </button>
                        )}
                        {bloquesConcatenados.length >= 2 && onDesconcatenarUltimoGrupo && (
                          <button
                            type="button"
                            onClick={() => onDesconcatenarUltimoGrupo(grupo.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                            title={`Separar el último grupo (Página ${bloquesConcatenados[bloquesConcatenados.length - 1].orden}) de vuelta a un grupo independiente`}
                          >
                            <Undo2 className="h-3 w-3" />
                            <span>Quitar último grupo (Pág. {bloquesConcatenados[bloquesConcatenados.length - 1].orden})</span>
                          </button>
                        )}
                      </div>

                      {/* Botón visible y claro para Cancelar Concatenación */}
                      <button
                        type="button"
                        onClick={() => onCambiarModoEstructura?.(grupo.id, 'INDEPENDIENTE')}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/30 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Cancelar concatenación y volver a páginas independientes"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Cancelar concatenación</span>
                      </button>
                    </div>

                    {/* Guía visual clara cuando el usuario activa concatenación pero aún falta unir otro grupo */}
                    {bloquesConcatenados.length < 2 && (
                      <div className="p-3 bg-primary/[0.04] border border-dashed border-primary/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground block">
                            Modo de concatenación activo
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            Todas las {pags.length} páginas de este grupo actúan como <strong>Página 1</strong>. Concatena otro grupo para agregar la Página 2 (o Reverso), o cancela para volver.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {otrosGrupos.length > 0 && onAbrirSelectorFusionarGrupo && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onAbrirSelectorFusionarGrupo(grupo.id)}
                              className="h-7 text-xs font-semibold gap-1.5"
                            >
                              <GitMerge className="h-3.5 w-3.5" />
                              Concatenar otro grupo...
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onCambiarModoEstructura?.(grupo.id, 'INDEPENDIENTE')}
                            className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 font-semibold"
                          >
                            <X className="h-3 w-3" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Bloques separados por número de página (Grupo 1 = todas Página 1; Grupo 2 = todas Página 2) */}
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {bloquesConcatenados.map((bloque, idxB) => {
                        const esUltimoBloque = idxB === bloquesConcatenados.length - 1 && bloquesConcatenados.length >= 2

                        return (
                          <div
                            key={bloque.orden}
                            className="rounded-lg border border-border/80 bg-background/70 p-2.5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="bg-foreground text-background font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wide">
                                  {bloque.titulo}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {bloque.paginas.length}{' '}
                                  {bloque.paginas.length === 1
                                    ? `página actúa como Página ${bloque.orden}`
                                    : `páginas actúan como Página ${bloque.orden}`}
                                </span>
                              </div>

                              {/* Opción en el encabezado del último bloque para quitarlo individualmente */}
                              {esUltimoBloque && onDesconcatenarUltimoGrupo && (
                                <button
                                  type="button"
                                  onClick={() => onDesconcatenarUltimoGrupo(grupo.id)}
                                  className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  title={`Separar el bloque Página ${bloque.orden} de vuelta a un grupo independiente`}
                                >
                                  <Undo2 className="h-3 w-3" />
                                  Quitar este grupo concatenado
                                </button>
                              )}
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 items-center">
                              {bloque.paginas.map((p) => {
                                const etiquetaOrigenPag = formatearOrigenPagina(
                                  p.pdfOrigen,
                                  p.nroPaginaEnPdf
                                )

                                return (
                                  <div
                                    key={p.id}
                                    className="relative w-28 shrink-0 bg-background rounded-lg border border-border/80 hover:border-primary/60 flex flex-col justify-between p-1.5 transition-all group/thumb shadow-2xs"
                                  >
                                    {!esDescartadas &&
                                      (onDescartarPagina ||
                                        (pags.length > 1 && onRemoverPagina)) && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (onDescartarPagina) {
                                              onDescartarPagina(grupo.id, p.id)
                                            } else if (onRemoverPagina) {
                                              onRemoverPagina(grupo.id, p.id)
                                            }
                                          }}
                                          className="absolute top-1 right-1 z-20 h-4 w-4 rounded-full bg-background/90 hover:bg-destructive text-muted-foreground hover:text-white border flex items-center justify-center cursor-pointer"
                                          title="Descartar página"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      )}

                                    <span
                                      className="absolute top-1 left-1 z-10 bg-foreground/85 text-background font-semibold text-[9px] px-1.5 py-0.5 rounded truncate max-w-[85px]"
                                      title={bloque.badge}
                                    >
                                      {bloque.badge}
                                    </span>

                                    <div
                                      onClick={() => onVerTodasPaginas(grupo)}
                                      className="relative w-full h-20 bg-muted/20 rounded flex items-center justify-center overflow-hidden cursor-pointer mt-4"
                                    >
                                      <img
                                        src={getPaginaThumbnailUrl(p.id)}
                                        alt={etiquetaOrigenPag}
                                        className="w-full h-full object-cover object-top"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none'
                                        }}
                                      />
                                    </div>

                                    <div className="w-full text-center mt-1">
                                      <span
                                        className="text-[10px] font-mono font-medium block truncate"
                                        title={etiquetaOrigenPag}
                                      >
                                        {etiquetaOrigenPag}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Botón visual (+) para agregar páginas de otros grupos específicamente a este bloque */}
                              {!esDescartadas && otrosGrupos.length > 0 && onAbrirSelectorTraerPagina && (
                                <button
                                  type="button"
                                  onClick={() => onAbrirSelectorTraerPagina(grupo.id, `Página ${bloque.orden}`)}
                                  className="w-20 h-[126px] shrink-0 rounded-lg border-2 border-dashed border-primary/40 hover:border-primary bg-primary/[0.03] hover:bg-primary/[0.08] text-primary flex flex-col items-center justify-center p-1 text-center cursor-pointer transition-all shadow-2xs group/add"
                                  title={`Agregar página de otro grupo al bloque Página ${bloque.orden}`}
                                >
                                  <div className="w-6 h-6 rounded-full bg-primary/10 group-hover/add:bg-primary group-hover/add:text-primary-foreground flex items-center justify-center transition-colors">
                                    <Plus className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="text-[10px] font-bold mt-1 text-primary">+ Pág</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Botón para concatenar otro grupo como bloque siguiente */}
                    {bloquesConcatenados.length >= 2 && otrosGrupos.length > 0 && onAbrirSelectorFusionarGrupo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAbrirSelectorFusionarGrupo(grupo.id)}
                        className="w-full text-xs font-semibold gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5 h-8 cursor-pointer"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                        + Concatenar otro grupo (como Página {bloquesConcatenados.length + 1})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BLOQUE LÓGICO 2 (Derecha, 7 cols): Tarea Primaria — Identificación del Tipo Documental */}
            <div className="lg:col-span-7 rounded-xl bg-muted/15 p-4 flex flex-col justify-between gap-4">
              {decision.modo === 'sugerido' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {/* Nivel 2: Label de campo */}
                    <span className="text-xs font-normal text-muted-foreground block">
                      Sugerencia detectada para este grupo
                    </span>
                    {/* Nivel 3: Valor de dato */}
                    <div className="text-sm font-semibold text-foreground">
                      {grupo.tipoDocumentoSugerido?.nombre || 'Tipo Sugerido'}
                    </div>
                  </div>

                  {/* Ley de Hick: 1 Acción Primaria clara + 1 Acción Secundaria */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onAceptarSugerido(grupo.id)}
                      className="h-9 px-4 gap-1.5 font-semibold"
                    >
                      <Check className="h-4 w-4" />
                      Confirmar sugerencia
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCambiarANuevoTipo(grupo.id)}
                      className="h-9 text-xs"
                    >
                      Asignar otro nombre
                    </Button>
                  </div>
                </div>
              )}

              {decision.modo === 'existente' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-normal text-muted-foreground">
                      Seleccionar tipo documental existente
                    </label>
                    <button
                      type="button"
                      onClick={() => onCambiarANuevoTipo(grupo.id)}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      Escribir nombre nuevo
                    </button>
                  </div>

                  <Select
                    value={decision.tipoId ? String(decision.tipoId) : ''}
                    onValueChange={(val) => onSeleccionarTipoExistente(grupo.id, val)}
                  >
                    <SelectTrigger className="h-10 text-sm font-semibold bg-background">
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
                <div className="space-y-2.5">
                  {/* Par Etiqueta-Valor vertical consistente */}
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`input-nombre-tipo-${grupo.id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {esDescartadas
                        ? 'Tipo de documento para páginas descartadas (opcional)'
                        : 'Nombre del tipo de documento'}
                    </label>

                    {tiposExistentes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onCambiarAOtroTipo(grupo.id)}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Elegir de tipos existentes
                      </button>
                    )}
                  </div>

                  <Input
                    id={`input-nombre-tipo-${grupo.id}`}
                    placeholder={
                      esDescartadas
                        ? 'OPCIONAL: DEJAR VACÍO O ESCRIBIR NOMBRE...'
                        : 'EJ: CERTIFICADO DE NOTAS, TITULO PROFESIONAL, RESOLUCION...'
                    }
                    value={decision.nombreNuevo || ''}
                    onChange={(e) => onTextoNuevoTipo(grupo.id, e.target.value)}
                    className={`h-10 text-sm font-semibold tracking-wide uppercase bg-background ${
                      esNombreDuplicado
                        ? 'border-destructive focus-visible:ring-destructive'
                        : 'border-border focus-visible:ring-primary'
                    }`}
                    autoFocus={autoFocus}
                  />

                  {esNombreDuplicado && (
                    <p className="text-xs font-medium text-destructive flex items-center gap-1.5 pt-0.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Ya existe otro grupo con este nombre en el lote. Renómbralo o concaténalo desde el menú.
                    </p>
                  )}
                </div>
              )}

              {/* DIVULGACIÓN PROGRESIVA: Acordeón sutil para opciones secundarias (Atajos de año y Concatenación) */}
              {!esDescartadas && (
                <div className="pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setMostrarOpcionesAvanzadas((prev) => !prev)}
                    className="flex items-center justify-between w-full text-xs font-normal text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3 w-3" />
                      Opciones de concatenación y atajos de año
                    </span>
                    {mostrarOpcionesAvanzadas ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {mostrarOpcionesAvanzadas && (
                    <div className="mt-3 space-y-3 pt-2 border-t border-dashed border-border/50 animate-in fade-in duration-150">
                      {/* Atajos rápidos de año */}
                      {onAnexarAnio && decision.modo === 'nuevo' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 mr-1">
                            <Calendar className="h-3 w-3" />
                            Anexar año:
                          </span>
                          {ANIOS_RAPIDOS.map((anio) => (
                            <button
                              key={anio}
                              type="button"
                              onClick={() => onAnexarAnio(grupo.id, anio)}
                              className="px-2 py-0.5 text-xs font-mono font-medium rounded-md bg-background hover:bg-primary/10 hover:text-primary border transition-colors cursor-pointer"
                            >
                              {anio}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Acciones secundarias de concatenación */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {otrosGrupos.length > 0 && onAbrirSelectorFusionarGrupo && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onAbrirSelectorFusionarGrupo(grupo.id)}
                            className="h-7 text-xs gap-1.5 font-normal"
                          >
                            <GitMerge className="h-3 w-3 text-muted-foreground" />
                            Concatenar con otro grupo...
                          </Button>
                        )}

                        {!estaConcatenadoPorUsuario && pags.length >= 2 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onCambiarModoEstructura?.(grupo.id, 'SECUENCIAL')}
                            className="h-7 text-xs gap-1.5 font-normal"
                          >
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            Definir concatenación interna
                          </Button>
                        )}

                        {otrosGrupos.length > 0 && onAbrirSelectorTraerPagina && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onAbrirSelectorTraerPagina(grupo.id)}
                            className="h-7 text-xs gap-1.5 font-normal text-muted-foreground hover:text-foreground"
                          >
                            <FolderInput className="h-3 w-3" />
                            Traer página...
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
