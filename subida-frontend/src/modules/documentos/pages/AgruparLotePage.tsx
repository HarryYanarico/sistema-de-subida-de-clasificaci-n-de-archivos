import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  ArrowRight,
  Layers,
  ArrowLeft,
  Wand2,
  Search,
  LayoutGrid,
  List,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { useAgruparLote } from '../hooks/useAgruparLote'
import { GrupoDecisionCard } from '../components/GrupoDecisionCard/GrupoDecisionCard'
import { GrupoPaginasModal } from '../components/GrupoPaginasModal/GrupoPaginasModal'
import { AlertaOrigenModal } from '../components/AlertaOrigenModal/AlertaOrigenModal'
import { AsistenteMultipaginaModal } from '../components/AsistenteMultipaginaModal/AsistenteMultipaginaModal'
import { SelectorInteractivoGrupoModal } from '../components/SelectorInteractivoGrupoModal/SelectorInteractivoGrupoModal'
import { SelectorInteractivoPaginasModal } from '../components/SelectorInteractivoPaginasModal/SelectorInteractivoPaginasModal'
import { PortapapelesFlotante } from '../components/PortapapelesFlotante/PortapapelesFlotante'

const GRUPOS_POR_PAGINA = 10

type FiltroEstadoGrupo = 'todos' | 'pendientes' | 'listos' | 'concatenados'
type DensidadVista = 'comoda' | 'compacta'

export function AgruparLotePage() {
  const { loteId } = useParams<{ loteId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    lote,
    grupos,
    tiposExistentes,
    decisiones,
    nombresEnEsteLote,
    gruposConNombreDuplicado,
    tieneNombresDuplicados,
    alertaOrigen,
    portapapeles,
    loadingLote,
    errorLote,
    errorEnvio,
    confirmando,
    totalGruposListos,
    todosGruposListos,
    handleAceptarSugerido,
    handleCambiarAOtroTipo,
    handleCambiarANuevoTipo,
    handleSeleccionarTipoExistente,
    handleTextoNuevoTipo,
    handleAplicarNombreAGrupo,
    handleAnexarAnioAGrupo,
    handleCopiarAlSiguiente,
    handleToggleDobleCara,
    handleCambiarFormatoCaras,
    handleCambiarModoEstructura,
    handleToggleParMixto,
    handleInvertirCaras,
    handleAnexarSiguientePagina,
    handleVincularReversoConSiguiente,
    handleRemoverPagina,
    handleDescartarPagina,
    handleMoverPagina,
    handleReordenarPaginas,
    handleCambiarEtiquetaPagina,
    handleMoverPaginaAGrupo,
    handleTraerPaginaDeGrupo,
    handleFusionarGrupos,
    handleFusionarMultiplesGrupos,
    handleCrearTipoMultipagina,
    handleDesconcatenarUltimoGrupo,
    handleDesanexarUltimaPagina,
    handleSepararGrupoEnPaginasIndividuales,
    handleConfirmarAgrupamiento,
    handleConfirmarAlertaOrigen,
    handleCancelarAlertaOrigen,
    handleTomarPaginaEnPortapapeles,
    handlePegarPaginaDesdePortapapeles,
    handleCancelarPortapapeles,
  } = useAgruparLote(loteId)

  // Controles de Filtrado, Búsqueda, Densidad y Divulgación Progresiva
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoGrupo>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [densidad, setDensidad] = useState<DensidadVista>('comoda')
  const [mostrarGuia, setMostrarGuia] = useState(false)

  // Modal para ver todas las páginas de un grupo (sincronizado en vivo con grupos)
  const [grupoParaModalId, setGrupoParaModalId] = useState<number | null>(null)
  const grupoParaModal = useMemo(
    () => (grupoParaModalId ? grupos.find((g) => g.id === grupoParaModalId) || null : null),
    [grupos, grupoParaModalId]
  )
  // Modal de asistente para armar tipo multi-página
  const [asistenteMultipaginaOpen, setAsistenteMultipaginaOpen] = useState(false)

  // Modal interactivo para mover página o fusionar grupo
  const [modalGrupoState, setModalGrupoState] = useState<{
    open: boolean
    modo: 'mover_pagina' | 'fusionar_grupo'
    grupoOrigenId: number
    paginaOrigen?: Pagina
  }>({
    open: false,
    modo: 'mover_pagina',
    grupoOrigenId: 0,
  })

  // Modal interactivo para traer página de otro grupo (Pull)
  const [modalPaginasState, setModalPaginasState] = useState<{
    open: boolean
    grupoDestinoId: number
    slotDestino?: string
  }>({
    open: false,
    grupoDestinoId: 0,
    slotDestino: undefined,
  })

  // Handlers para abrir los selectores interactivos
  const handleAbrirSelectorMoverPagina = (pagina: Pagina, grupoId: number) => {
    setModalGrupoState({
      open: true,
      modo: 'mover_pagina',
      grupoOrigenId: grupoId,
      paginaOrigen: pagina,
    })
  }

  const handleAbrirSelectorFusionarGrupo = (grupoId: number) => {
    setModalGrupoState({
      open: true,
      modo: 'fusionar_grupo',
      grupoOrigenId: grupoId,
      paginaOrigen: undefined,
    })
  }

  const handleAbrirSelectorTraerPagina = (grupoId: number, slotDestino?: string) => {
    setModalPaginasState({
      open: true,
      grupoDestinoId: grupoId,
      slotDestino,
    })
  }

  const handleSeleccionarDestinoModalGrupo = (
    grupoDestinoId: number,
    slotDestino?: string
  ) => {
    if (modalGrupoState.modo === 'mover_pagina' && modalGrupoState.paginaOrigen) {
      handleMoverPaginaAGrupo(
        modalGrupoState.paginaOrigen.id,
        modalGrupoState.grupoOrigenId,
        grupoDestinoId,
        slotDestino
      )
    } else if (modalGrupoState.modo === 'fusionar_grupo') {
      handleFusionarGrupos(grupoDestinoId, modalGrupoState.grupoOrigenId)
    }
    setModalGrupoState((prev) => ({ ...prev, open: false }))
  }

  const handleTraerPaginaDesdeModal = (
    grupoOrigenId: number,
    paginaId: number,
    slotDestino?: string
  ) => {
    const slotFinal = slotDestino || modalPaginasState.slotDestino
    handleTraerPaginaDeGrupo(
      modalPaginasState.grupoDestinoId,
      grupoOrigenId,
      paginaId,
      slotFinal
    )
    setModalPaginasState((prev) => ({ ...prev, open: false }))
  }

  // Separar grupos normales del grupo especial "Descartadas" (RF-18, RT-12)
  const gruposNormales = useMemo(
    () => grupos.filter((g) => g.estado !== 'descartadas'),
    [grupos]
  )
  const grupoDescartadas = useMemo(
    () => grupos.find((g) => g.estado === 'descartadas') || null,
    [grupos]
  )

  // Mapa de índice real (1..N) de cada grupo normal para mantener numeración consistente al filtrar
  const mapaIndiceReal = useMemo(() => {
    const mapa = new Map<number, number>()
    gruposNormales.forEach((g, idx) => mapa.set(g.id, idx + 1))
    return mapa
  }, [gruposNormales])

  // Clasificación de cada grupo para facetas y métricas
  const esGrupoListo = useMemo(() => {
    const setListos = new Set<number>()
    for (const g of gruposNormales) {
      if (gruposConNombreDuplicado.has(g.id)) continue
      const dec = decisiones[g.id]
      if (!dec) continue
      const tieneNombre =
        (dec.modo === 'sugerido' && dec.confirmado) ||
        (dec.modo === 'existente' && Boolean(dec.tipoId)) ||
        (dec.modo === 'nuevo' && Boolean(dec.nombreNuevo?.trim()))
      if (tieneNombre) setListos.add(g.id)
    }
    return setListos
  }, [gruposNormales, decisiones, gruposConNombreDuplicado])

  const conteosFacetas = useMemo(() => {
    let pendientes = 0
    let listos = 0
    let concatenados = 0
    for (const g of gruposNormales) {
      if (esGrupoListo.has(g.id)) {
        listos++
      } else {
        pendientes++
      }
      const dec = decisiones[g.id]
      if (dec?.modoEstructura && dec.modoEstructura !== 'INDEPENDIENTE') {
        concatenados++
      }
    }
    return {
      todos: gruposNormales.length,
      pendientes,
      listos,
      concatenados,
    }
  }, [gruposNormales, esGrupoListo, decisiones])

  // Filtrado por faceta + búsqueda rápida (Punto 4: Filtrado, Búsqueda y Densidad)
  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return gruposNormales.filter((g) => {
      const dec = decisiones[g.id]
      const listo = esGrupoListo.has(g.id)
      const concatenado = Boolean(
        dec?.modoEstructura && dec.modoEstructura !== 'INDEPENDIENTE'
      )

      if (filtroEstado === 'pendientes' && listo) return false
      if (filtroEstado === 'listos' && !listo) return false
      if (filtroEstado === 'concatenados' && !concatenado) return false

      if (!q) return true

      const numGrupo = String(mapaIndiceReal.get(g.id) || '')
      const nombreNuevo = (dec?.nombreNuevo || '').toLowerCase()
      const nombreSugerido = (g.tipoDocumentoSugerido?.nombre || '').toLowerCase()
      const tipoExistente =
        tiposExistentes
          .find((t) => Number(t.id) === Number(dec?.tipoId))
          ?.nombre.toLowerCase() || ''
      const coincidePdf = (g.paginas || []).some((p) =>
        (p.pdfOrigen || '').toLowerCase().includes(q)
      )

      return (
        numGrupo === q.replace('#', '') ||
        `grupo ${numGrupo}`.includes(q) ||
        nombreNuevo.includes(q) ||
        nombreSugerido.includes(q) ||
        tipoExistente.includes(q) ||
        coincidePdf
      )
    })
  }, [gruposNormales, decisiones, esGrupoListo, filtroEstado, busqueda, mapaIndiceReal, tiposExistentes])

  // RF-13: Si hay más de 10 grupos en la vista actual, paginar de 10 en 10
  const [paginaActual, setPaginaActual] = useState(1)
  const mostrarPaginacion = gruposFiltrados.length > GRUPOS_POR_PAGINA

  const totalPaginasLote = Math.max(1, Math.ceil(gruposFiltrados.length / GRUPOS_POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginasLote)

  const gruposPaginados: Grupo[] = useMemo(() => {
    if (!mostrarPaginacion) return gruposFiltrados
    const inicio = (paginaSegura - 1) * GRUPOS_POR_PAGINA
    return gruposFiltrados.slice(inicio, inicio + GRUPOS_POR_PAGINA)
  }, [gruposFiltrados, mostrarPaginacion, paginaSegura])

  const onConfirmar = async () => {
    try {
      const res = await handleConfirmarAgrupamiento()
      if (res?.id) {
        if (res.incompletos) {
          navigate(ROUTES.LOTES.REVISION(loteId!))
        } else if (lote?.persona?.codigo) {
          navigate(ROUTES.PERSONAS.CASILLERO(lote.persona.id))
        } else {
          navigate(ROUTES.LOTES.DETALLE(loteId!))
        }
      }
    } catch {
      // Error manejado en hook
    }
  }

  if (loadingLote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          Analizando y cargando grupos del lote...
        </span>
      </div>
    )
  }

  if (errorLote || !lote) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-semibold text-sm">Lote no disponible</div>
            <div className="text-xs">
              {errorLote?.message ||
                'No se encontró el lote especificado o no pertenece a su unidad.'}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.DASHBOARD)}>
          Volver al Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-28" ref={containerRef}>
      {/* NAVEGACIÓN SUPERIOR Y CONTEXTO DE PERSONA */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Subir otro lote
        </Button>

        {lote.persona && (
          <div className="flex items-center gap-2 bg-muted/50 border px-3 py-1 rounded-full text-xs">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Expediente:</span>
            <span className="font-semibold text-foreground">
              {lote.persona.nombres} {lote.persona.apellidos} ({lote.persona.codigo})
            </span>
          </div>
        )}
      </div>

      {/* 1. MODULARIZACIÓN Y CHUNKING: Cabecera + Tarjetas de Métricas Independientes */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              {/* Nivel 1 Tipográfico: Título principal */}
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Revisión de Grupos y Nombres de Tipos
              </h1>
              {/* Nivel 2 Tipográfico: Subtítulo neutro */}
              <p className="text-xs text-muted-foreground mt-0.5">
                Lote:{' '}
                <span className="font-mono font-medium text-foreground">
                  {lote.nombreArchivoOriginal}
                </span>
              </p>
            </div>
          </div>

          {/* Acciones Secundarias en Cabecera (Ley de Hick) */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMostrarGuia((prev) => !prev)}
              className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              ¿Cómo funciona?
              {mostrarGuia ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAsistenteMultipaginaOpen(true)}
              className="text-xs h-8 gap-1.5 font-medium"
            >
              <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
              Asistente Multi-Página
            </Button>
          </div>
        </div>

        {/* Divulgación Progresiva: Guía de uso oculta por defecto */}
        {mostrarGuia && (
          <div className="p-4 rounded-xl bg-muted/30 border text-xs text-muted-foreground space-y-1.5 animate-in fade-in duration-150">
            <div className="font-semibold text-foreground">
              Guía rápida de revisión de grupos
            </div>
            <p>
              1. Cada tarjeta agrupa <strong>páginas visual y textualmente similares</strong> detectadas en el lote (no están concatenadas entre sí).
            </p>
            <p>
              2. Asigna un <strong>nombre único de tipo documental</strong> a cada grupo. Al confirmar, cada página del grupo se guardará como un ejemplar individual de ese tipo.
            </p>
            <p>
              3. Solo si un documento tiene varias partes o caras (ej. Anverso en un grupo y Reverso en otro), usa el menú <strong>⋯</strong> de la tarjeta para <strong>Concatenar grupos</strong>.
            </p>
          </div>
        )}

        {/* Bloques de Métricas (Card-based UI — Ley de Miller) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-normal text-muted-foreground block">
                Total páginas
              </span>
              <span className="text-xl font-bold text-foreground">
                {lote.totalPaginas}
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-normal text-muted-foreground block">
                Grupos similares
              </span>
              <span className="text-xl font-bold text-foreground">
                {gruposNormales.length}
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-normal text-muted-foreground block">
                Pendientes de atención
              </span>
              <span
                className={`text-xl font-bold ${
                  conteosFacetas.pendientes > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                }`}
              >
                {conteosFacetas.pendientes}
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-normal text-muted-foreground block">
                Listos para guardar
              </span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                {conteosFacetas.listos}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. FILTRADO POR FACETAS, BÚSQUEDA Y CONTROL DE DENSIDAD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border rounded-xl p-3 shadow-2xs">
        {/* Facetas rápidas (Chips) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setFiltroEstado('todos')
              setPaginaActual(1)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filtroEstado === 'todos'
                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({conteosFacetas.todos})
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroEstado('pendientes')
              setPaginaActual(1)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filtroEstado === 'pendientes'
                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Pendientes ({conteosFacetas.pendientes})
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroEstado('listos')
              setPaginaActual(1)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filtroEstado === 'listos'
                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Listos ({conteosFacetas.listos})
          </button>

          {conteosFacetas.concatenados > 0 && (
            <button
              type="button"
              onClick={() => {
                setFiltroEstado('concatenados')
                setPaginaActual(1)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                filtroEstado === 'concatenados'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Concatenados ({conteosFacetas.concatenados})
            </button>
          )}
        </div>

        {/* Buscador y Selector de Densidad (Cómoda vs Compacta) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setPaginaActual(1)
              }}
              placeholder="Buscar grupo, nombre o PDF..."
              className="h-8 pl-8 pr-7 text-xs bg-background"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setPaginaActual(1)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className="flex items-center p-0.5 rounded-lg bg-muted border text-xs shrink-0"
            title="Alternar densidad de visualización"
          >
            <button
              type="button"
              onClick={() => setDensidad('comoda')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                densidad === 'comoda'
                  ? 'bg-background text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cómoda</span>
            </button>
            <button
              type="button"
              onClick={() => setDensidad('compacta')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                densidad === 'compacta'
                  ? 'bg-background text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compacta</span>
            </button>
          </div>
        </div>
      </div>

      {errorEnvio && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorEnvio}</span>
        </div>
      )}

      {/* LISTA DE TARJETAS DE GRUPOS */}
      {gruposPaginados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              No hay grupos que coincidan con el filtro actual
            </p>
            <p className="text-xs text-muted-foreground">
              Prueba cambiando el filtro de estado o limpiando el término de búsqueda.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFiltroEstado('todos')
                setBusqueda('')
                setPaginaActual(1)
              }}
              className="mt-2 text-xs"
            >
              Mostrar todos los grupos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={densidad === 'compacta' ? 'space-y-2.5' : 'space-y-5'}>
          {gruposPaginados.map((grupo: Grupo, idx: number) => {
            const indexReal = mapaIndiceReal.get(grupo.id) || idx + 1
            const decision = decisiones[grupo.id] || {
              modo: tiposExistentes.length === 0 ? 'nuevo' : 'sugerido',
              confirmado: false,
              esDobleCara: false,
            }
            const esUltimo = indexReal === gruposNormales.length
            const siguienteNumero = !esUltimo ? indexReal + 1 : undefined

            return (
              <GrupoDecisionCard
                key={grupo.id}
                grupo={grupo}
                indexReal={indexReal}
                decision={decision}
                tiposExistentes={tiposExistentes}
                nombresEnEsteLote={nombresEnEsteLote}
                esNombreDuplicado={gruposConNombreDuplicado.has(grupo.id)}
                densidad={densidad}
                puedeCopiarAlSiguiente={false}
                puedeVincularConSiguiente={!esUltimo}
                siguienteNumeroGrupo={siguienteNumero}
                todosLosGrupos={grupos}
                itemPortapapeles={portapapeles}
                onAceptarSugerido={handleAceptarSugerido}
                onCambiarAOtroTipo={handleCambiarAOtroTipo}
                onCambiarANuevoTipo={handleCambiarANuevoTipo}
                onSeleccionarTipoExistente={handleSeleccionarTipoExistente}
                onTextoNuevoTipo={handleTextoNuevoTipo}
                onAplicarNombre={handleAplicarNombreAGrupo}
                onAnexarAnio={handleAnexarAnioAGrupo}
                onCopiarAlSiguiente={handleCopiarAlSiguiente}
                onToggleDobleCara={handleToggleDobleCara}
                onCambiarFormatoCaras={handleCambiarFormatoCaras}
                onCambiarModoEstructura={handleCambiarModoEstructura}
                onToggleParMixto={handleToggleParMixto}
                onInvertirCaras={handleInvertirCaras}
                onAnexarSiguientePagina={handleAnexarSiguientePagina}
                onVincularReversoConSiguiente={handleVincularReversoConSiguiente}
                onRemoverPagina={handleRemoverPagina}
                onDescartarPagina={handleDescartarPagina}
                onMoverPagina={handleMoverPagina}
                onReordenarPaginas={handleReordenarPaginas}
                onCambiarEtiquetaPagina={handleCambiarEtiquetaPagina}
                onMoverPaginaAGrupo={handleMoverPaginaAGrupo}
                onTraerPaginaDeGrupo={handleTraerPaginaDeGrupo}
                onFusionarGrupos={handleFusionarGrupos}
                onAbrirSelectorMoverPagina={handleAbrirSelectorMoverPagina}
                onAbrirSelectorTraerPagina={handleAbrirSelectorTraerPagina}
                onAbrirSelectorFusionarGrupo={handleAbrirSelectorFusionarGrupo}
                onTomarPaginaEnPortapapeles={handleTomarPaginaEnPortapapeles}
                onPegarPaginaDesdePortapapeles={handlePegarPaginaDesdePortapapeles}
                onDesconcatenarUltimoGrupo={handleDesconcatenarUltimoGrupo}
                onDesanexarUltimaPagina={handleDesanexarUltimaPagina}
                onSepararGrupo={handleSepararGrupoEnPaginasIndividuales}
                onVerTodasPaginas={(g) => setGrupoParaModalId(g.id)}
                autoFocus={idx === 0}
              />
            )
          })}
        </div>
      )}

      {/* Paginación de 10 en 10 si > 10 grupos (RF-13) */}
      {mostrarPaginacion && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            Mostrando {(paginaSegura - 1) * GRUPOS_POR_PAGINA + 1}–
            {Math.min(paginaSegura * GRUPOS_POR_PAGINA, gruposFiltrados.length)} de{' '}
            {gruposFiltrados.length} grupos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaginaActual((p) => Math.max(1, p - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={paginaSegura === 1}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <span className="text-xs font-medium px-2">
              Página {paginaSegura} de {totalPaginasLote}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaginaActual((p) => Math.min(totalPaginasLote, p + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={paginaSegura === totalPaginasLote}
              className="h-8 text-xs gap-1"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* RF-18, RF-19, RT-12: Grupo "Descartadas" al final de la lista, colapsado por defecto */}
      {grupoDescartadas && (grupoDescartadas.paginas?.length || 0) > 0 && (
        <div className="pt-4 border-t border-dashed">
          <GrupoDecisionCard
            key={`descartadas-${grupoDescartadas.id}`}
            grupo={grupoDescartadas}
            indexReal={grupos.length}
            decision={
              decisiones[grupoDescartadas.id] || {
                modo: 'nuevo',
                nombreNuevo: '',
                confirmado: false,
                esDobleCara: false,
              }
            }
            tiposExistentes={tiposExistentes}
            nombresEnEsteLote={nombresEnEsteLote}
            esNombreDuplicado={gruposConNombreDuplicado.has(grupoDescartadas.id)}
            esGrupoDescartadas={true}
            colapsadoPorDefecto={true}
            densidad="comoda"
            puedeCopiarAlSiguiente={false}
            puedeVincularConSiguiente={false}
            todosLosGrupos={grupos}
            itemPortapapeles={portapapeles}
            onAceptarSugerido={handleAceptarSugerido}
            onCambiarAOtroTipo={handleCambiarAOtroTipo}
            onCambiarANuevoTipo={handleCambiarANuevoTipo}
            onSeleccionarTipoExistente={handleSeleccionarTipoExistente}
            onTextoNuevoTipo={handleTextoNuevoTipo}
            onAplicarNombre={handleAplicarNombreAGrupo}
            onAnexarAnio={handleAnexarAnioAGrupo}
            onToggleDobleCara={handleToggleDobleCara}
            onCambiarFormatoCaras={handleCambiarFormatoCaras}
            onCambiarModoEstructura={handleCambiarModoEstructura}
            onToggleParMixto={handleToggleParMixto}
            onInvertirCaras={handleInvertirCaras}
            onMoverPagina={handleMoverPagina}
            onReordenarPaginas={handleReordenarPaginas}
            onCambiarEtiquetaPagina={handleCambiarEtiquetaPagina}
            onMoverPaginaAGrupo={handleMoverPaginaAGrupo}
            onAbrirSelectorMoverPagina={handleAbrirSelectorMoverPagina}
            onTomarPaginaEnPortapapeles={handleTomarPaginaEnPortapapeles}
            onPegarPaginaDesdePortapapeles={handlePegarPaginaDesdePortapapeles}
            onVerTodasPaginas={(g) => setGrupoParaModalId(g.id)}
          />
        </div>
      )}

      {/* 5. PRIORIZACIÓN DE ACCIONES (Ley de Hick): Barra fija inferior con la única Acción Primaria */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t p-4 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {tieneNombresDuplicados ? (
              <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                Hay grupos con nombres duplicados en este lote. Renombra los duplicados para poder confirmar.
              </Badge>
            ) : todosGruposListos ? (
              <Badge className="bg-green-600 text-white gap-1 px-2.5 py-1 text-xs">
                <CheckCircle className="h-3.5 w-3.5" />
                Todos los grupos listos ({totalGruposListos}/{grupos.length})
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 px-2.5 py-1 text-xs"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {totalGruposListos} de {grupos.length} grupos completados
                </Badge>
                {conteosFacetas.pendientes > 0 && filtroEstado !== 'pendientes' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroEstado('pendientes')
                      setPaginaActual(1)
                    }}
                    className="text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    Ver solo pendientes ({conteosFacetas.pendientes})
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            id="btn-confirmar-agrupamiento"
            onClick={onConfirmar}
            disabled={!todosGruposListos || confirmando || tieneNombresDuplicados}
            className="gap-2 font-semibold shadow-md px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {confirmando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando y creando documentos...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Confirmar y Guardar Documentos ({grupos.length})
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal para ver todas las páginas del grupo con botón X para descartar páginas (RF-15, RF-16, RT-08, RT-09) */}
      <GrupoPaginasModal
        grupo={grupoParaModal}
        decision={grupoParaModal ? decisiones[grupoParaModal.id] : undefined}
        onClose={() => setGrupoParaModalId(null)}
        onDescartarPagina={
          grupoParaModal && grupoParaModal.estado !== 'descartadas'
            ? handleDescartarPagina
            : undefined
        }
      />

      {/* Modal de Advertencia de Origen PDF Mixto */}
      <AlertaOrigenModal
        open={alertaOrigen.open}
        origenPagina={alertaOrigen.origenPagina}
        origenDestino={alertaOrigen.origenDestino}
        onConfirmar={handleConfirmarAlertaOrigen}
        onCancelar={handleCancelarAlertaOrigen}
      />

      {/* Modal Asistente Multi-Página */}
      <AsistenteMultipaginaModal
        open={asistenteMultipaginaOpen}
        grupos={grupos}
        tiposExistentes={tiposExistentes}
        onCerrar={() => setAsistenteMultipaginaOpen(false)}
        onCrearMultipagina={handleCrearTipoMultipagina}
      />

      {/* Portapapeles Flotante para Cortar y Pegar Páginas entre grupos */}
      <PortapapelesFlotante
        item={portapapeles}
        onCancelar={handleCancelarPortapapeles}
      />

      {/* Modal Interactivo de Exploración de Grupos (Mover Página / Fusionar Grupo Simple o Múltiple) */}
      <SelectorInteractivoGrupoModal
        open={modalGrupoState.open}
        modo={modalGrupoState.modo}
        grupoOrigenId={modalGrupoState.grupoOrigenId}
        paginaOrigen={modalGrupoState.paginaOrigen}
        grupos={grupos}
        decisiones={decisiones}
        onCerrar={() => setModalGrupoState((prev) => ({ ...prev, open: false }))}
        onSeleccionarDestino={handleSeleccionarDestinoModalGrupo}
        onFusionarMultiples={(idsOrigen) => {
          handleFusionarMultiplesGrupos(idsOrigen, modalGrupoState.grupoOrigenId)
          setModalGrupoState((prev) => ({ ...prev, open: false }))
        }}
      />

      {/* Modal Interactivo de Galería de Páginas para Traer (Pull) */}
      <SelectorInteractivoPaginasModal
        open={modalPaginasState.open}
        grupoDestinoId={modalPaginasState.grupoDestinoId}
        grupos={grupos}
        onCerrar={() => setModalPaginasState((prev) => ({ ...prev, open: false }))}
        onTraerPagina={handleTraerPaginaDesdeModal}
      />
    </div>
  )
}
