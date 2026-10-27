import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_LOTE_REVISION } from '@graphql/queries/lote.queries'
import {
  ASIGNAR_PAGINA_A_DOCUMENTO_INCOMPLETO,
  MARCAR_DOCUMENTO_COMPLETO,
  DESCARTAR_DOCUMENTO_INCOMPLETO,
} from '@graphql/mutations/lote.mutations'
import { ROUTES } from '@config/routes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Check,
  Layers,
  ExternalLink,
} from 'lucide-react'
import { Documento, Pagina } from '@app-types/documento.types'
import { getPaginaThumbnailUrl } from '../services/upload.service'

export function LoteRevisionPage() {
  const { loteId } = useParams<{ loteId: string }>()
  const navigate = useNavigate()

  const { data, loading, error, refetch } = useQuery(GET_LOTE_REVISION, {
    variables: { loteId },
    fetchPolicy: 'network-only',
    skip: !loteId,
  })

  const [asignarPaginaMutation, { loading: asignando }] = useMutation(
    ASIGNAR_PAGINA_A_DOCUMENTO_INCOMPLETO
  )
  const [marcarCompletoMutation, { loading: completando }] = useMutation(
    MARCAR_DOCUMENTO_COMPLETO
  )
  const [descartarMutation, { loading: descartando }] = useMutation(
    DESCARTAR_DOCUMENTO_INCOMPLETO
  )

  const [docSeleccionadoParaAsignar, setDocSeleccionadoParaAsignar] = useState<number | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const revision = data?.loteRevision
  const lote = revision?.lote
  const incompletos: Documento[] = revision?.documentosIncompletos || []
  const huerfanas: Pagina[] = revision?.paginasHuerfanas || []

  const handleAsignarHuerfana = async (docId: number, pagId: number) => {
    try {
      await asignarPaginaMutation({
        variables: {
          documentoId: String(docId),
          paginaId: String(pagId),
        },
      })
      setMensajeExito('Página asignada correctamente al documento.')
      setDocSeleccionadoParaAsignar(null)
      refetch()
    } catch (e: any) {
      alert(`Error al asignar página: ${e?.message || e}`)
    }
  }

  const handleMarcarCompleto = async (docId: number) => {
    if (!confirm('¿Deseas marcar este documento como completo a pesar de tener slots vacíos?')) {
      return
    }
    try {
      await marcarCompletoMutation({
        variables: { documentoId: String(docId) },
      })
      setMensajeExito('Documento aceptado como completo.')
      refetch()
    } catch (e: any) {
      alert(`Error: ${e?.message || e}`)
    }
  }

  const handleDescartar = async (docId: number) => {
    if (!confirm('¿Deseas descartar este documento? Sus páginas pasarán a la cola de sin agrupar.')) {
      return
    }
    try {
      await descartarMutation({
        variables: { documentoId: String(docId) },
      })
      setMensajeExito('Documento descartado. Páginas devueltas a huérfanas.')
      refetch()
    } catch (e: any) {
      alert(`Error: ${e?.message || e}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando cola de revisión del lote...</span>
      </div>
    )
  }

  if (error || !revision) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error?.message || 'No se pudo cargar la información de revisión del lote.'}</span>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.LOTES.DETALLE(loteId!))}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver al lote
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.LOTES.DETALLE(loteId!))}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Lote #{loteId}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Revisión de Documentos Incompletos (Lote #{loteId})
              </h1>
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-xs">
                {incompletos.length} pendientes
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {lote.nombreArchivoOriginal} · {lote.persona ? `${lote.persona.nombres} ${lote.persona.apellidos}` : 'Sin persona asignada'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lote.persona?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(ROUTES.PERSONAS.CASILLERO(lote.persona.id))}
              className="text-xs h-8"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ir al Casillero
            </Button>
          )}
        </div>
      </div>

      {mensajeExito && (
        <div className="p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-700 dark:text-green-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" /> {mensajeExito}
          </span>
          <button
            onClick={() => setMensajeExito(null)}
            className="text-[11px] font-semibold underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Si ya no quedan incompletos */}
      {incompletos.length === 0 ? (
        <Card className="border-green-500/40 bg-green-500/[0.03]">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold">¡Lote completamente saneado!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No existen documentos con slots vacíos ni incompletos en este lote. Todos han sido confirmados o resueltos satisfactoriamente.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              {lote.persona?.id ? (
                <Button onClick={() => navigate(ROUTES.PERSONAS.CASILLERO(lote.persona.id))}>
                  Ver Casillero de la Persona
                </Button>
              ) : (
                <Button onClick={() => navigate(ROUTES.LOTES.DETALLE(loteId!))}>
                  Ver Detalle del Lote
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lista de Documentos Incompletos */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Documentos con slots pendientes ({incompletos.length})
              </span>
            </div>

            {incompletos.map((doc: Documento) => {
              const pagsDoc = doc.paginas || []
              const esSeleccionado = docSeleccionadoParaAsignar === doc.id

              return (
                <Card
                  key={doc.id}
                  className={`border transition-all shadow-xs ${
                    esSeleccionado
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]'
                      : 'border-amber-500/30'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-semibold"
                        >
                          Doc #{doc.id} · INCOMPLETO
                        </Badge>
                        <span className="text-sm font-bold text-foreground">
                          {doc.nombreFinal || doc.tipoDocumento?.nombre || 'Documento sin nombre'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={completando}
                          onClick={() => handleMarcarCompleto(doc.id)}
                          className="h-7 text-xs gap-1 text-green-700 dark:text-green-300 hover:bg-green-500/10 border-green-500/30"
                          title="Aceptar este documento como completo aunque tenga slots pendientes"
                        >
                          <Check className="h-3 w-3" /> Aceptar completo igual
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={descartando}
                          onClick={() => handleDescartar(doc.id)}
                          className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                          title="Descartar este documento y liberar sus páginas a huérfanas"
                        >
                          <Trash2 className="h-3 w-3" /> Descartar
                        </Button>
                      </div>
                    </div>

                    {/* Miniaturas de páginas presentes */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground block">
                        Páginas actuales ({pagsDoc.length} de slots esperados):
                      </span>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {pagsDoc.map((p, pIdx) => (
                          <div
                            key={p.id}
                            className="relative w-24 shrink-0 bg-muted/30 rounded-lg border p-1 flex flex-col justify-between"
                          >
                            <Badge className="absolute top-1 left-1 bg-slate-800 text-[8px] px-1 py-0 z-10">
                              Slot {pIdx + 1}
                            </Badge>
                            <div className="w-full h-20 bg-muted/20 rounded overflow-hidden mt-4">
                              <img
                                src={getPaginaThumbnailUrl(p.id)}
                                alt=""
                                className="w-full h-full object-cover object-top"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-center block mt-1">
                              Pág. {p.nroPaginaEnPdf}
                            </span>
                          </div>
                        ))}

                        {/* Slot vacío representativo */}
                        <div
                          onClick={() =>
                            setDocSeleccionadoParaAsignar(
                              esSeleccionado ? null : doc.id
                            )
                          }
                          className={`w-28 shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-colors ${
                            esSeleccionado
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-amber-400/60 bg-amber-500/5 hover:border-primary text-amber-600'
                          }`}
                        >
                          <Plus className="h-5 w-5 mb-1" />
                          <span className="text-[10px] font-semibold">
                            {esSeleccionado ? 'Listo para asignar' : 'Slot vacío (falta página)'}
                          </span>
                          <span className="text-[9px] text-muted-foreground block mt-0.5">
                            {esSeleccionado
                              ? 'Haz click en una huérfana ➔'
                              : 'Click para seleccionar'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Bandeja de Páginas Huérfanas del Lote */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="border sticky top-4">
              <CardHeader className="p-3.5 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    Páginas Huérfanas del Lote ({huerfanas.length})
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    Sin agrupar
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
                {huerfanas.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No hay páginas huérfanas disponibles en este lote.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docSeleccionadoParaAsignar && (
                      <div className="p-2 rounded bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center justify-between">
                        <span>Asignando al Doc #{docSeleccionadoParaAsignar}</span>
                        <button
                          onClick={() => setDocSeleccionadoParaAsignar(null)}
                          className="text-[10px] underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {huerfanas.map((pag) => (
                      <div
                        key={pag.id}
                        className="p-2 rounded-lg border bg-background hover:border-primary/50 transition-all flex items-center gap-3"
                      >
                        <div className="w-12 h-14 bg-muted rounded overflow-hidden border shrink-0">
                          <img
                            src={getPaginaThumbnailUrl(pag.id)}
                            alt=""
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <span className="text-xs font-semibold block truncate">
                            Pág. {pag.nroPaginaEnPdf}
                          </span>
                          {pag.pdfOrigen && (
                            <span className="text-[9px] text-muted-foreground font-mono block truncate">
                              {pag.pdfOrigen}
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {pag.textoOcr ? pag.textoOcr.slice(0, 45) : 'Sin texto OCR'}
                          </p>
                        </div>

                        {docSeleccionadoParaAsignar ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={asignando}
                            onClick={() =>
                              handleAsignarHuerfana(
                                docSeleccionadoParaAsignar,
                                pag.id
                              )
                            }
                            className="h-7 text-xs px-2 shrink-0 gap-1"
                          >
                            <Plus className="h-3 w-3" /> Asignar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={incompletos.length === 0 || asignando}
                            onClick={() => {
                              if (incompletos.length === 1) {
                                handleAsignarHuerfana(incompletos[0].id, pag.id)
                              } else {
                                setDocSeleccionadoParaAsignar(incompletos[0].id)
                              }
                            }}
                            className="h-7 text-xs px-2 shrink-0"
                            title="Asignar al primer documento incompleto"
                          >
                            + Asignar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
