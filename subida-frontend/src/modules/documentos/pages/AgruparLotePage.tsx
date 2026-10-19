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
  Sparkles,
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  PlusCircle,
  HelpCircle,
  Check,
} from 'lucide-react'
import { Grupo, Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'

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
  const todosGruposListos = useMemo(() => {
    if (!grupos.length) return false
    return grupos.every((g) => {
      const dec = decisiones[g.id]
      if (!dec) return false
      if (dec.modo === 'sugerido') return dec.confirmado
      if (dec.modo === 'existente') return Boolean(dec.tipoId)
      if (dec.modo === 'nuevo') return Boolean(dec.nombreNuevo?.trim())
      return false
    })
  }, [grupos, decisiones])

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
        navigate(ROUTES.LOTES.DETALLE(loteId))
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
        <span className="text-sm text-muted-foreground">Cargando grupos del lote...</span>
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
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* Encabezado Principal */}
      <div className="border-b pb-4 space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            Lote procesado: {lote.totalPaginas} páginas. El sistema encontró {grupos.length} grupos.
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Archivo: <span className="font-mono font-medium text-foreground">{lote.nombreArchivoOriginal}</span> ·
          Revise las coincidencias detectadas, asigne tipos y confirme los documentos de doble cara.
        </p>
      </div>

      {errorEnvio && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorEnvio}</span>
        </div>
      )}

      {/* Lista de Tarjetas de Grupos */}
      <div className="space-y-4">
        {gruposPaginados.map((grupo, idx) => {
          const indexReal = mostrarPaginacion ? (paginaActual - 1) * GRUPOS_POR_PAGINA + idx + 1 : idx + 1
          const pags = grupo.paginas || []
          const primeraPagina = pags[0]
          const textoMuestra = (primeraPagina?.textoOcr || '').trim().slice(0, 200)
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

          return (
            <Card
              key={grupo.id}
              className={`border transition-all shadow-sm ${
                decision.confirmado
                  ? 'border-green-500/40 bg-green-500/[0.02]'
                  : 'border-border/80 hover:border-primary/40'
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Cabecera del Grupo */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      Grupo #{indexReal}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {pags.length} {pags.length === 1 ? 'página' : 'páginas'}
                    </span>
                    {decision.confirmado && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
                        <Check className="h-3 w-3" /> Listo para confirmar
                      </Badge>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGrupoParaModal(grupo)}
                    className="text-xs gap-1 text-primary hover:text-primary/80"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver todas las páginas del grupo ({pags.length})
                  </Button>
                </div>

                {/* Contenido: Muestras + Texto + Acciones */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Miniaturas de muestra (2-3 primeras) */}
                  <div className="md:col-span-4 flex gap-2 overflow-x-auto pb-1">
                    {pags.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setGrupoParaModal(grupo)}
                        className="w-20 h-28 shrink-0 bg-muted/40 rounded border flex flex-col items-center justify-center p-1.5 cursor-pointer hover:border-primary transition-colors text-center"
                        title={`Página ${p.nroPaginaEnPdf}: Click para ver completa`}
                      >
                        <FileText className="h-6 w-6 text-muted-foreground/70 mb-1" />
                        <span className="text-[10px] font-mono font-medium">Pág. {p.nroPaginaEnPdf}</span>
                        <span className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">
                          {p.textoOcr ? p.textoOcr.slice(0, 30) : 'Sin OCR'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Texto de muestra (primeros 200 caracteres) */}
                  <div className="md:col-span-8 flex flex-col justify-between space-y-3">
                    <div className="bg-muted/30 p-2.5 rounded border text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3">
                      {textoMuestra ? `"${textoMuestra}..."` : '(Páginas sin texto OCR extraído)'}
                    </div>

                    {/* Lógica de Coincidencia de Tipo */}
                    <div className="space-y-2 pt-1">
                      {decision.modo === 'sugerido' && grupo.tipoDocumentoSugerido && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <span>✅ Se parece a:</span>
                            <Badge variant="secondary" className="font-semibold text-xs bg-primary/10 text-primary">
                              {grupo.tipoDocumentoSugerido.nombre}
                            </Badge>
                            <span className="text-muted-foreground">¿Confirmas?</span>
                          </div>

                          {!decision.confirmado ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                id={`btn-confirmar-sugerido-${grupo.id}`}
                                onClick={() => handleAceptarSugerido(grupo.id)}
                                className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Sí
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                id={`btn-otro-tipo-${grupo.id}`}
                                onClick={() => handleCambiarAOtroTipo(grupo.id)}
                                className="h-7 text-xs gap-1"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                No, es otro tipo
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCambiarAOtroTipo(grupo.id)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cambiar tipo
                            </Button>
                          )}
                        </div>
                      )}

                      {decision.modo === 'existente' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Seleccionar tipo:</span>
                          <Select
                            value={decision.tipoId ? String(decision.tipoId) : ''}
                            onValueChange={(val) => handleSeleccionarTipoExistente(grupo.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs w-[240px]">
                              <SelectValue placeholder="Elegir tipo de documento..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tiposExistentes.map((t) => (
                                <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                                  {t.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCambiarANuevoTipo(grupo.id)}
                            className="h-8 text-xs gap-1"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Crear tipo nuevo
                          </Button>
                        </div>
                      )}

                      {decision.modo === 'nuevo' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ No coincide con ningún tipo existente.
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                            <Input
                              id={`input-nombre-tipo-${grupo.id}`}
                              placeholder="Nombre del nuevo tipo (ej. Contrato de Alquiler)"
                              value={decision.nombreNuevo || ''}
                              onChange={(e) => handleTextoNuevoTipo(grupo.id, e.target.value)}
                              className="h-8 text-xs"
                            />
                            {tiposExistentes.length > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleCambiarAOtroTipo(grupo.id)}
                                className="h-8 text-xs shrink-0"
                              >
                                Usar existente
                              </Button>
                            )}
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
                            className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground"
                          >
                            ☑ Estas páginas consecutivas son documentos de doble cara (anverso/reverso)
                          </label>
                        </div>
                      )}
                    </div>
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
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4" />
            {!todosGruposListos ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Debe confirmar o asignar un tipo a todos los grupos para continuar.
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400 font-medium">
                Todos los grupos están clasificados. Listo para persistir.
              </span>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            id="btn-confirmar-agrupamiento"
            onClick={handleConfirmarAgrupamiento}
            disabled={!todosGruposListos || confirmando}
            className="gap-2 font-semibold shadow"
          >
            {confirmando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando agrupamiento...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Confirmar agrupamiento
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
              Total de páginas: {grupoParaModal?.paginas?.length || 0}. Revise el texto extraído por OCR.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {grupoParaModal?.paginas?.map((p: Pagina) => (
              <div key={p.id} className="border rounded-md p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Página {p.nroPaginaEnPdf}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.estado}
                  </Badge>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground line-clamp-6 bg-background p-2 rounded border">
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
