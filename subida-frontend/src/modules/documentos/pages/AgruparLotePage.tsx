import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_LOTE } from '@graphql/queries/lote.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import { CONFIRMAR_AGRUPAMIENTO } from '@graphql/mutations/lote.mutations'
import { ROUTES } from '@config/routes'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  PlusCircle,
  Check,
  User,
  ArrowRight,
  Layers,
  ArrowLeft,
} from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { getPaginaThumbnailUrl } from '../services/upload.service'

interface DecisionGrupo {
  modo: 'sugerido' | 'existente' | 'nuevo'
  tipoId?: number | null
  nombreNuevo?: string
  confirmado: boolean
  esDobleCara: boolean
}

export function AgruparLotePage() {
  const { loteId } = useParams<{ loteId: string }>()
  const navigate = useNavigate()

  // Queries
  const { data: loteData, loading: loadingLote, error: errorLote } = useQuery(GET_LOTE, {
    variables: { id: loteId },
    fetchPolicy: 'network-only',
  })
  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })

  // Mutación
  const [confirmarAgrupamientoMutation, { loading: confirmando }] =
    useMutation(CONFIRMAR_AGRUPAMIENTO)

  // Decisiones de asignación por cada grupo (key = grupo.id)
  const [decisiones, setDecisiones] = useState<Record<number, DecisionGrupo>>({})

  // Modal para ver todas las páginas de un grupo
  const [grupoParaModal, setGrupoParaModal] = useState<Grupo | null>(null)

  // Paginación si hay más de 50 grupos
  const [paginaActual, setPaginaActual] = useState(1)
  const GRUPOS_POR_PAGINA = 10

  const lote = loteData?.lote
  const tiposExistentes: TipoDocumento[] = tiposData?.tiposDocumento || []
  const grupos: Grupo[] = useMemo(() => lote?.grupos || [], [lote])

  // Inicializar decisiones cuando cargan los grupos
  useEffect(() => {
    if (!grupos.length) return

    setDecisiones((prev) => {
      const inicial: Record<number, DecisionGrupo> = { ...prev }
      for (const g of grupos) {
        if (inicial[g.id]) continue

        const tieneParejaConsecutiva =
          g.paginas &&
          g.paginas.length >= 2 &&
          g.paginas.some((p, i) => {
            const next = g.paginas?.[i + 1]
            return next && next.nroPaginaEnPdf === p.nroPaginaEnPdf + 1
          })

        if (g.tipoDocumentoSugerido) {
          inicial[g.id] = {
            modo: 'sugerido',
            tipoId: Number(g.tipoDocumentoSugerido.id),
            confirmado: false,
            esDobleCara: Boolean(tieneParejaConsecutiva),
          }
        } else {
          inicial[g.id] = {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: Boolean(tieneParejaConsecutiva),
          }
        }
      }
      return inicial
    })
  }, [grupos])

  // Handlers para las acciones por grupo
  const handleAceptarSugerido = (grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        confirmado: true,
      },
    }))
  }

  const handleCambiarAOtroTipo = (grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'existente',
        tipoId: null,
        confirmado: false,
      },
    }))
  }

  const handleCambiarANuevoTipo = (grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'nuevo',
        nombreNuevo: '',
        confirmado: false,
      },
    }))
  }

  const handleSeleccionarTipoExistente = (grupoId: number, tipoIdStr: string) => {
    const tid = Number(tipoIdStr)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        tipoId: tid,
        confirmado: true,
      },
    }))
  }

  const handleTextoNuevoTipo = (grupoId: number, texto: string) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        nombreNuevo: texto,
        confirmado: texto.trim().length > 0,
      },
    }))
  }

  const handleToggleDobleCara = (grupoId: number, checked: boolean) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        esDobleCara: checked,
      },
    }))
  }

  // Validación: todos los grupos deben tener confirmación o nombre
  const totalGruposListos = useMemo(() => {
    if (!grupos.length) return 0
    return grupos.filter((g) => {
      const dec = decisiones[g.id]
      if (!dec) return false
      if (dec.modo === 'sugerido') return dec.confirmado
      if (dec.modo === 'existente') return Boolean(dec.tipoId)
      if (dec.modo === 'nuevo') return Boolean(dec.nombreNuevo?.trim())
      return false
    }).length
  }, [grupos, decisiones])

  const todosGruposListos = totalGruposListos === grupos.length && grupos.length > 0

  // Enviar confirmación al backend
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const handleConfirmarAgrupamiento = async () => {
    if (!todosGruposListos || !loteId) return
    setErrorEnvio(null)

    const asignaciones = grupos.map((g) => {
      const dec = decisiones[g.id]
      return {
        grupoId: String(g.id),
        tipoDocumentoId: dec?.modo !== 'nuevo' && dec?.tipoId ? dec.tipoId : null,
        nombreNuevoTipo: dec?.modo === 'nuevo' && dec?.nombreNuevo ? dec.nombreNuevo.trim() : null,
        esDobleCara: Boolean(dec?.esDobleCara),
      }
    })

    try {
      const res = await confirmarAgrupamientoMutation({
        variables: {
          loteId: String(loteId),
          asignaciones,
        },
      })
      if (res.data?.confirmarAgrupamiento?.id) {
        if (lote?.persona?.codigo) {
          navigate(ROUTES.PERSONAS.CASILLERO(lote.persona.id))
        } else {
          navigate(ROUTES.LOTES.DETALLE(loteId))
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar agrupamiento'
      setErrorEnvio(msg)
    }
  }

  // Paginación si > 50 grupos
  const mostrarPaginacion = grupos.length > 50
  const gruposPaginados = useMemo(() => {
    if (!mostrarPaginacion) return grupos
    const inicio = (paginaActual - 1) * GRUPOS_POR_PAGINA
    return grupos.slice(inicio, inicio + GRUPOS_POR_PAGINA)
  }, [grupos, mostrarPaginacion, paginaActual])

  const totalPaginasLote = Math.ceil(grupos.length / GRUPOS_POR_PAGINA)

  if (loadingLote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Analizando y cargando grupos del lote...</span>
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
              {errorLote?.message || 'No se encontró el lote especificado o no pertenece a su unidad.'}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}>
          Volver a Subida
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-28">
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
              Asignado a: <strong>{lote.persona.nombres} {lote.persona.apellidos}</strong> ({lote.persona.codigo})
            </span>
          </div>
        )}
      </div>

      {/* Encabezado Principal */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-2">
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
                Archivo: <span className="font-mono font-medium text-foreground">{lote.nombreArchivoOriginal}</span> · Total: <strong>{lote.totalPaginas}</strong> páginas divididas en <strong>{grupos.length}</strong> grupo(s).
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-xs px-3 py-1 font-semibold border-primary/30 text-primary bg-primary/5">
            {totalGruposListos} de {grupos.length} grupos completados
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border mt-2">
          👉 Revisa las miniaturas de cada grupo. Si coincide con un tipo sugerido, pulsa <strong>Confirmar</strong>. Si es un tipo nuevo, <strong>escribe su nombre</strong> directamente en el recuadro destacado.
        </p>
      </div>

      {errorEnvio && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorEnvio}</span>
        </div>
      )}

      {/* Lista de Tarjetas de Grupos */}
      <div className="space-y-5">
        {gruposPaginados.map((grupo, idx) => {
          const indexReal = mostrarPaginacion ? (paginaActual - 1) * GRUPOS_POR_PAGINA + idx + 1 : idx + 1
          const pags = grupo.paginas || []
          const primeraPagina = pags[0]
          const textoMuestra = (primeraPagina?.textoOcr || '').trim().slice(0, 220)
          const decision = decisiones[grupo.id] || {
            modo: 'nuevo',
            confirmado: false,
            esDobleCara: false,
          }

          const tieneParejasConsecutivas =
            pags.length >= 2 &&
            pags.some((p, i) => {
              const next = pags[i + 1]
              return next && next.nroPaginaEnPdf === p.nroPaginaEnPdf + 1
            })

          const listoParaGuardar =
            (decision.modo === 'sugerido' && decision.confirmado) ||
            (decision.modo === 'existente' && Boolean(decision.tipoId)) ||
            (decision.modo === 'nuevo' && Boolean(decision.nombreNuevo?.trim()))

          return (
            <Card
              key={grupo.id}
              className={`border transition-all shadow-sm ${
                listoParaGuardar
                  ? 'border-green-500/50 bg-green-500/[0.02]'
                  : 'border-border/90 hover:border-primary/50'
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Cabecera del Grupo */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 font-semibold">
                      Grupo #{indexReal}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
                    </span>
                    {listoParaGuardar ? (
                      <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 text-xs gap-1 font-medium">
                        <Check className="h-3 w-3 text-green-600" /> Listo para guardar
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs">
                        Pendiente de nombrar
                      </Badge>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGrupoParaModal(grupo)}
                    className="text-xs gap-1.5 text-primary hover:text-primary/80"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver todas las páginas ({pags.length})
                  </Button>
                </div>

                {/* Contenido: Muestras Visuales + Texto + Acciones */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Miniaturas de muestra con imagen real de la página */}
                  <div className="md:col-span-4 flex gap-2.5 overflow-x-auto pb-1">
                    {pags.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setGrupoParaModal(grupo)}
                        className="relative w-24 h-32 shrink-0 bg-muted/30 rounded-lg border border-border/80 flex flex-col justify-between p-1.5 cursor-pointer hover:border-primary hover:shadow-md transition-all overflow-hidden group/thumb"
                        title={`Página ${p.nroPaginaEnPdf}: Click para ver completa`}
                      >
                        <div className="relative w-full h-20 bg-muted/20 rounded flex items-center justify-center overflow-hidden">
                          <img
                            src={getPaginaThumbnailUrl(p.id)}
                            alt={`Pág ${p.nroPaginaEnPdf}`}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <FileText className="h-6 w-6 text-muted-foreground/40 absolute -z-0" />
                        </div>
                        <div className="w-full text-center">
                          <span className="text-[11px] font-mono font-semibold block">Pág. {p.nroPaginaEnPdf}</span>
                          <span className="text-[9px] text-muted-foreground line-clamp-1">
                            {p.textoOcr ? p.textoOcr.slice(0, 25) : 'Sin OCR'}
                          </span>
                        </div>
                      </div>
                    ))}
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
                            <span className="text-xs text-muted-foreground">El sistema detectó coincidencia con:</span>
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
                                onClick={() => handleAceptarSugerido(grupo.id)}
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
                                onClick={() => handleCambiarAOtroTipo(grupo.id)}
                                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                No, elegir o crear otro
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 text-xs gap-1">
                                <Check className="h-3 w-3" /> Confirmado
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCambiarAOtroTipo(grupo.id)}
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
                          <span className="text-xs font-medium text-foreground">Seleccionar tipo existente:</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCambiarANuevoTipo(grupo.id)}
                            className="h-7 text-xs gap-1 text-primary hover:text-primary/90"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Escribir nombre de tipo nuevo
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={decision.tipoId ? String(decision.tipoId) : ''}
                            onValueChange={(val) => handleSeleccionarTipoExistente(grupo.id, val)}
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

                    {/* DECISIÓN C: Tipo Nuevo (CAMPO PROMINENTE SOLICITADO) */}
                    {decision.modo === 'nuevo' && (
                      <div className="p-4 rounded-xl border-2 border-primary/40 bg-primary/[0.03] space-y-2.5 shadow-sm">
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
                              onClick={() => handleCambiarAOtroTipo(grupo.id)}
                              className="h-7 text-xs"
                            >
                              Elegir de lista existente
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              id={`input-nombre-tipo-${grupo.id}`}
                              placeholder="Escribe el nombre del tipo (ej: Certificado de Notas, Contrato, Diploma...)"
                              value={decision.nombreNuevo || ''}
                              onChange={(e) => handleTextoNuevoTipo(grupo.id, e.target.value)}
                              className="h-10 text-sm font-medium border-primary/40 focus-visible:ring-primary bg-background shadow-inner"
                              autoFocus={idx === 0}
                            />
                            {decision.nombreNuevo?.trim() ? (
                              <Badge className="bg-green-600 text-white shrink-0 h-10 px-3 gap-1 text-xs font-medium">
                                <Check className="h-3.5 w-3.5" /> Asignado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400 shrink-0 h-10 px-2.5 text-xs">
                                Ingresa el nombre
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Al confirmar, este nombre creará un nuevo tipo de documento y el sistema aprenderá su firma para clasificarlo automáticamente en el futuro.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Checkbox de doble cara si contiene páginas consecutivas */}
                    {tieneParejasConsecutivas && (
                      <div className="flex items-center space-x-2 pt-2 border-t mt-2">
                        <Checkbox
                          id={`checkbox-doble-cara-${grupo.id}`}
                          checked={decision.esDobleCara}
                          onCheckedChange={(checked) => handleToggleDobleCara(grupo.id, checked)}
                        />
                        <label
                          htmlFor={`checkbox-doble-cara-${grupo.id}`}
                          className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                        >
                          <span>📄📄</span>
                          <span>Documento de dos caras: Anverso y Reverso (se guardará como un solo documento en el casillero)</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
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
              onClick={() => setPaginaActual((p) => Math.min(totalPaginasLote, p + 1))}
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
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 px-2.5 py-1 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                {totalGruposListos} de {grupos.length} grupos asignados (asigna los faltantes para guardar)
              </Badge>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            id="btn-confirmar-agrupamiento"
            onClick={handleConfirmarAgrupamiento}
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
      <Dialog open={!!grupoParaModal} onOpenChange={(open) => !open && setGrupoParaModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>Todas las páginas del Grupo #{grupoParaModal?.id}</DialogTitle>
            <DialogDescription>
              Total de páginas: {grupoParaModal?.paginas?.length || 0}. Revisa las miniaturas y el texto OCR extraído.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {grupoParaModal?.paginas?.map((p: Pagina) => (
              <div key={p.id} className="border rounded-lg p-3 bg-card space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Página {p.nroPaginaEnPdf}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.estado}
                  </Badge>
                </div>
                <div className="w-full h-36 bg-muted/20 rounded overflow-hidden flex items-center justify-center border relative">
                  <img
                    src={getPaginaThumbnailUrl(p.id)}
                    alt={`Página ${p.nroPaginaEnPdf}`}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <FileText className="h-8 w-8 text-muted-foreground/30 absolute" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground line-clamp-4 bg-muted/30 p-2 rounded border">
                  {p.textoOcr || '(Sin texto OCR)'}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
