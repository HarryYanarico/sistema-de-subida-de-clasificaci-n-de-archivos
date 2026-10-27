import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ROUTES } from '@config/routes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Info,
  Wand2,
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
    handleInvertirCaras,
    handleAnexarSiguientePagina,
    handleVincularReversoConSiguiente,
    handleRemoverPagina,
    handleMoverPagina,
    handleCambiarEtiquetaPagina,
    handleMoverPaginaAGrupo,
    handleTraerPaginaDeGrupo,
    handleFusionarGrupos,
    handleCrearTipoMultipagina,
    handleDesanexarUltimaPagina,
    handleSepararGrupoEnPaginasIndividuales,
    handleConfirmarAgrupamiento,
    handleConfirmarAlertaOrigen,
    handleCancelarAlertaOrigen,
    handleTomarPaginaEnPortapapeles,
    handlePegarPaginaDesdePortapapeles,
    handleCancelarPortapapeles,
  } = useAgruparLote(loteId)

  // Modal para ver todas las páginas de un grupo
  const [grupoParaModal, setGrupoParaModal] = useState<Grupo | null>(null)
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
  }>({
    open: false,
    grupoDestinoId: 0,
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

  const handleAbrirSelectorTraerPagina = (grupoId: number) => {
    setModalPaginasState({
      open: true,
      grupoDestinoId: grupoId,
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
      // modalGrupoState.grupoOrigenId es el grupo donde se pulsó "Fusionar grupo aquí"
      // grupoDestinoId es el grupo que se va a incorporar adentro de éste
      handleFusionarGrupos(grupoDestinoId, modalGrupoState.grupoOrigenId)
    }
    setModalGrupoState((prev) => ({ ...prev, open: false }))
  }

  const handleTraerPaginaDesdeModal = (
    grupoOrigenId: number,
    paginaId: number,
    slotDestino?: string
  ) => {
    handleTraerPaginaDeGrupo(
      modalPaginasState.grupoDestinoId,
      grupoOrigenId,
      paginaId,
      slotDestino
    )
    setModalPaginasState((prev) => ({ ...prev, open: false }))
  }

  // Paginación si hay más de 50 grupos
  const [paginaActual, setPaginaActual] = useState(1)
  const mostrarPaginacion = grupos.length > 50

  const gruposPaginados: Grupo[] = useMemo(() => {
    if (!mostrarPaginacion) return grupos
    const inicio = (paginaActual - 1) * GRUPOS_POR_PAGINA
    return grupos.slice(inicio, inicio + GRUPOS_POR_PAGINA)
  }, [grupos, mostrarPaginacion, paginaActual])

  const totalPaginasLote = Math.ceil(grupos.length / GRUPOS_POR_PAGINA)

  const onConfirmar = async () => {
    try {
      const res = await handleConfirmarAgrupamiento()
      if (res?.id) {
        if (res.incompletos) {
          // Si quedaron documentos incompletos, navegar a la cola de revisión del lote (Punto D)
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
      {/* Botón superior de volver */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Subir otro PDF
        </Button>

        {lote.persona && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium">
            <User className="h-3.5 w-3.5" />
            <span>
              Asignado a:{' '}
              <strong>
                {lote.persona.nombres} {lote.persona.apellidos}
              </strong>{' '}
              ({lote.persona.codigo})
            </span>
          </div>
        )}
      </div>

      {/* Encabezado Principal con Asistente Multi-Página */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Revisión de Grupos y Nombres de Tipos
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Archivo:{' '}
                <span className="font-mono font-medium text-foreground">
                  {lote.nombreArchivoOriginal}
                </span>{' '}
                · Total: <strong>{lote.totalPaginas}</strong> páginas divididas en{' '}
                <strong>{grupos.length}</strong> grupo(s).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAsistenteMultipaginaOpen(true)}
              className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Asistente: Armar Multi-Página
            </Button>

            <Badge
              variant="outline"
              className="text-xs px-3 py-1 font-semibold border-primary/30 text-primary bg-primary/5"
            >
              {totalGruposListos} de {grupos.length} grupos completados
            </Badge>
          </div>
        </div>

        {/* Banner si es la primera vez sin tipos existentes */}
        {tiposExistentes.length === 0 ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Primera digitalización:</strong> Aún no hay tipos de documento registrados
              en tu unidad. Al confirmar, el sistema creará automáticamente los tipos que nombres y
              aprenderá sus firmas para los próximos lotes.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
            👉 Revisa las miniaturas de cada grupo. Si coincide con un tipo sugerido, pulsa{' '}
            <strong>Confirmar</strong>. Si es un tipo nuevo, <strong>escribe su nombre</strong>{' '}
            directamente en el recuadro destacado. Puedes mover páginas libremente entre cualquier grupo (Push y Pull) o fusionar grupos completos.
          </p>
        )}
      </div>

      {errorEnvio && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorEnvio}</span>
        </div>
      )}

      {/* Lista de Tarjetas de Grupos */}
      <div className="space-y-5">
        {gruposPaginados.map((grupo: Grupo, idx: number) => {
          const indexReal = mostrarPaginacion
            ? (paginaActual - 1) * GRUPOS_POR_PAGINA + idx + 1
            : idx + 1
          const decision = decisiones[grupo.id] || {
            modo: tiposExistentes.length === 0 ? 'nuevo' : 'sugerido',
            confirmado: false,
            esDobleCara: false,
          }
          const esUltimo = indexReal === grupos.length
          const siguienteNumero = !esUltimo ? indexReal + 1 : undefined

          return (
            <GrupoDecisionCard
              key={grupo.id}
              grupo={grupo}
              indexReal={indexReal}
              decision={decision}
              tiposExistentes={tiposExistentes}
              nombresEnEsteLote={nombresEnEsteLote}
              puedeCopiarAlSiguiente={!esUltimo}
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
              onInvertirCaras={handleInvertirCaras}
              onAnexarSiguientePagina={handleAnexarSiguientePagina}
              onVincularReversoConSiguiente={handleVincularReversoConSiguiente}
              onRemoverPagina={handleRemoverPagina}
              onMoverPagina={handleMoverPagina}
              onCambiarEtiquetaPagina={handleCambiarEtiquetaPagina}
              onMoverPaginaAGrupo={handleMoverPaginaAGrupo}
              onTraerPaginaDeGrupo={handleTraerPaginaDeGrupo}
              onFusionarGrupos={handleFusionarGrupos}
              onAbrirSelectorMoverPagina={handleAbrirSelectorMoverPagina}
              onAbrirSelectorTraerPagina={handleAbrirSelectorTraerPagina}
              onAbrirSelectorFusionarGrupo={handleAbrirSelectorFusionarGrupo}
              onTomarPaginaEnPortapapeles={handleTomarPaginaEnPortapapeles}
              onPegarPaginaDesdePortapapeles={handlePegarPaginaDesdePortapapeles}
              onDesanexarUltimaPagina={handleDesanexarUltimaPagina}
              onSepararGrupo={handleSepararGrupoEnPaginasIndividuales}
              onVerTodasPaginas={setGrupoParaModal}
              autoFocus={idx === 0}
            />
          )
        })}
      </div>

      {/* Paginación si > 50 grupos */}
      {mostrarPaginacion && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            Mostrando grupos {(paginaActual - 1) * GRUPOS_POR_PAGINA + 1} a{' '}
            {Math.min(paginaActual * GRUPOS_POR_PAGINA, grupos.length)} de {grupos.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaginaActual((p) => Math.max(1, p - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={paginaActual === 1}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <span className="text-xs font-medium px-2">
              Página {paginaActual} de {totalPaginasLote}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaginaActual((p) => Math.min(totalPaginasLote, p + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={paginaActual === totalPaginasLote}
              className="h-8 text-xs gap-1"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Barra fija inferior con botón de Confirmación */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t p-4 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {todosGruposListos ? (
              <Badge className="bg-green-600 text-white gap-1 px-2.5 py-1 text-xs">
                <CheckCircle className="h-3.5 w-3.5" />
                ¡Todos los grupos listos! ({totalGruposListos}/{grupos.length})
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 px-2.5 py-1 text-xs"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {totalGruposListos} de {grupos.length} grupos asignados (asigna los faltantes para
                guardar)
              </Badge>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            id="btn-confirmar-agrupamiento"
            onClick={onConfirmar}
            disabled={!todosGruposListos || confirmando}
            className="gap-2 font-semibold shadow-md px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {confirmando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando y creando tipos...
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

      {/* Modal para ver todas las páginas del grupo */}
      <GrupoPaginasModal grupo={grupoParaModal} onClose={() => setGrupoParaModal(null)} />

      {/* Modal de Advertencia de Origen PDF Mixto (Punto C) */}
      <AlertaOrigenModal
        open={alertaOrigen.open}
        origenPagina={alertaOrigen.origenPagina}
        origenDestino={alertaOrigen.origenDestino}
        onConfirmar={handleConfirmarAlertaOrigen}
        onCancelar={handleCancelarAlertaOrigen}
      />

      {/* Modal Asistente Multi-Página (Punto B) */}
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

      {/* Modal Interactivo de Exploración de Grupos (Mover Página / Fusionar Grupo) */}
      <SelectorInteractivoGrupoModal
        open={modalGrupoState.open}
        modo={modalGrupoState.modo}
        grupoOrigenId={modalGrupoState.grupoOrigenId}
        paginaOrigen={modalGrupoState.paginaOrigen}
        grupos={grupos}
        decisiones={decisiones}
        onCerrar={() => setModalGrupoState((prev) => ({ ...prev, open: false }))}
        onSeleccionarDestino={handleSeleccionarDestinoModalGrupo}
      />

      {/* Modal Interactivo de Galería de Páginas para Traer (Pull) */}
      <SelectorInteractivoPaginasModal
        open={modalPaginasState.open}
        grupoDestinoId={modalPaginasState.grupoDestinoId}
        grupos={grupos}
        onCerrar={() => setModalPaginasState((prev) => ({ ...prev, open: false }))}
        onTraerPagina={handleTraerPaginaDesdeModal}
      />

      {/* Datalist accesible para autocompletar en los inputs de nombres */}
      <datalist id="tipos-lote-list">
        {Array.from(
          new Set([...tiposExistentes.map((t) => t.nombre), ...nombresEnEsteLote])
        ).map((nombre) => (
          <option key={nombre} value={nombre} />
        ))}
      </datalist>
    </div>
  )
}
