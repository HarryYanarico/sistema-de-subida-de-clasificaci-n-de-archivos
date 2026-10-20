import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_PAGINAS_SIN_AGRUPAR } from '@graphql/queries/revision.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import {
  ASIGNAR_PAGINA_A_TIPO,
  CREAR_TIPO_Y_ASIGNAR,
  DESCARTAR_PAGINA,
} from '@graphql/mutations/documento.mutations'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Layers,
  CheckCircle2,
  Trash2,
  PlusCircle,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
  Calendar,
  FolderOpen,
} from 'lucide-react'
import { Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'

type ModoAccion = 'existente' | 'nuevo' | 'descartar'

interface EstadoTarjeta {
  modo: ModoAccion
  tipoId?: string
  nombreNuevo?: string
}

const PAGE_SIZE = 50

export function RevisionSinAgruparPage() {
  const [offset, setOffset] = useState(0)
  const [paginasAcumuladas, setPaginasAcumuladas] = useState<Pagina[]>([])

  // Queries
  const { loading, error, refetch, data } = useQuery(GET_PAGINAS_SIN_AGRUPAR, {
    variables: { limit: PAGE_SIZE, offset },
    fetchPolicy: 'network-only',
    onCompleted: (res) => {
      const items: Pagina[] = res?.paginasSinAgrupar || []
      if (offset === 0) {
        setPaginasAcumuladas(items)
      } else {
        setPaginasAcumuladas((prev) => {
          const existentesIds = new Set(prev.map((p) => p.id))
          const nuevos = items.filter((p) => !existentesIds.has(p.id))
          return [...prev, ...nuevos]
        })
      }
    },
  })

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
  })
  const tipos: TipoDocumento[] = tiposData?.tiposDocumento || []

  // Mutaciones
  const [asignarPaginaMutation] = useMutation(ASIGNAR_PAGINA_A_TIPO)
  const [crearTipoYAsignarMutation] = useMutation(CREAR_TIPO_Y_ASIGNAR)
  const [descartarPaginaMutation] = useMutation(DESCARTAR_PAGINA)

  // Estados locales por tarjeta
  const [estados, setEstados] = useState<Record<number, EstadoTarjeta>>({})
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [errorAccion, setErrorAccion] = useState<{ id: number; mensaje: string } | null>(null)

  // Modal para ver página completa / OCR
  const [paginaParaModal, setPaginaParaModal] = useState<Pagina | null>(null)

  const paginas = paginasAcumuladas.length > 0 ? paginasAcumuladas : (data?.paginasSinAgrupar || [])
  const hayMas = data?.paginasSinAgrupar?.length === PAGE_SIZE

  const getEstadoTarjeta = (paginaId: number): EstadoTarjeta => {
    return (
      estados[paginaId] || {
        modo: 'existente',
        tipoId: tipos.length > 0 ? String(tipos[0].id) : undefined,
        nombreNuevo: '',
      }
    )
  }

  const setModo = (paginaId: number, modo: ModoAccion) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        modo,
      },
    }))
    if (errorAccion?.id === paginaId) setErrorAccion(null)
  }

  const setTipoId = (paginaId: number, tipoId: string) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        tipoId,
      },
    }))
    if (errorAccion?.id === paginaId) setErrorAccion(null)
  }

  const setNombreNuevo = (paginaId: number, nombreNuevo: string) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        nombreNuevo,
      },
    }))
    if (errorAccion?.id === paginaId) setErrorAccion(null)
  }

  const handleConfirmar = async (pagina: Pagina) => {
    const config = getEstadoTarjeta(pagina.id)
    setErrorAccion(null)
    setGuardandoId(pagina.id)

    try {
      if (config.modo === 'existente') {
        const tid = config.tipoId || (tipos.length > 0 ? String(tipos[0].id) : null)
        if (!tid) {
          throw new Error('Selecciona un tipo de documento existente')
        }
        await asignarPaginaMutation({
          variables: {
            paginaId: String(pagina.id),
            tipoDocumentoId: String(tid),
          },
        })
      } else if (config.modo === 'nuevo') {
        const nombre = (config.nombreNuevo || '').trim()
        if (!nombre) {
          throw new Error('Ingresa el nombre del nuevo tipo de documento')
        }
        await crearTipoYAsignarMutation({
          variables: {
            paginaId: String(pagina.id),
            nombre,
          },
        })
      } else if (config.modo === 'descartar') {
        await descartarPaginaMutation({
          variables: {
            paginaId: String(pagina.id),
          },
        })
      }

      // Remover de la lista local
      setPaginasAcumuladas((prev) => prev.filter((p) => p.id !== pagina.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la página'
      setErrorAccion({ id: pagina.id, mensaje: msg })
    } finally {
      setGuardandoId(null)
    }
  }

  const cargarMas = () => {
    setOffset((prev) => prev + PAGE_SIZE)
  }

  const recargarCola = () => {
    setOffset(0)
    refetch({ limit: PAGE_SIZE, offset: 0 })
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cola Residual: Páginas Sin Agrupar</h1>
              <p className="text-sm text-muted-foreground">
                Páginas no resueltas por el clasificador automático (OCR borroso, escaneos atípicos o texto aislado)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-mono">
            {paginas.length} {paginas.length === 1 ? 'página pendiente' : 'páginas pendientes'}
          </Badge>
          <Button variant="outline" size="sm" onClick={recargarCola} disabled={loading}>
            Refrescar
          </Button>
        </div>
      </div>

      {/* Estados de carga y error global */}
      {loading && paginas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Consultando páginas residuales...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error.message}</span>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && paginas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-semibold">Cola residual limpia</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No hay páginas pendientes de revisión manual. Todos los documentos fueron agrupados o clasificados con éxito.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de Tarjetas */}
      {paginas.length > 0 && (
        <div className="space-y-4">
          {paginas.map((pagina: Pagina) => {
            const config = getEstadoTarjeta(pagina.id)
            const estaGuardando = guardandoId === pagina.id
            const errorFila = errorAccion?.id === pagina.id ? errorAccion?.mensaje : null
            const textoMuestra = (pagina.textoOcr || '').trim()

            return (
              <Card
                key={pagina.id}
                className="hover:border-primary/40 transition-colors shadow-sm overflow-hidden"
              >
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Visualización / Miniatura */}
                    <div className="lg:col-span-3 flex flex-col items-center justify-center bg-muted/20 border rounded-lg p-3 text-center gap-2">
                      <div
                        onClick={() => setPaginaParaModal(pagina)}
                        className="w-24 h-32 rounded border bg-card shadow-sm flex flex-col items-center justify-center p-2 cursor-pointer hover:border-primary transition-all group relative"
                        title="Click para ver el texto OCR completo"
                      >
                        <FileText className="h-8 w-8 text-muted-foreground/60 group-hover:text-primary transition-colors mb-1" />
                        <span className="text-xs font-mono font-bold">Pág. {pagina.nroPaginaEnPdf}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                          {textoMuestra ? textoMuestra.slice(0, 25) : 'Sin texto'}
                        </span>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs rounded transition-opacity gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          Ver OCR
                        </div>
                      </div>

                      <div className="w-full space-y-1 text-xs text-muted-foreground">
                        <div className="truncate font-mono" title={pagina.pdfOrigen}>
                          {pagina.pdfOrigen}
                        </div>
                        {pagina.loteNombre && (
                          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground/80 truncate">
                            <FolderOpen className="h-3 w-3" />
                            <span className="truncate">{pagina.loteNombre}</span>
                          </div>
                        )}
                        {pagina.createdAt && (
                          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/60">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(pagina.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contenido OCR + Opciones de Resolución */}
                    <div className="lg:col-span-9 flex flex-col justify-between space-y-4">
                      {/* Fragmento de texto OCR */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Texto Extraído por OCR (primeros 200 caracteres):
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPaginaParaModal(pagina)}
                            className="h-6 text-xs gap-1 text-primary hover:text-primary/80"
                          >
                            <Eye className="h-3 w-3" /> Ver completo
                          </Button>
                        </div>

                        <div className="p-3 rounded-md bg-muted/30 border font-mono text-xs text-foreground/90 leading-relaxed max-h-24 overflow-y-auto">
                          {textoMuestra ? (
                            `"${textoMuestra.slice(0, 200)}${textoMuestra.length > 200 ? '...' : ''}"`
                          ) : (
                            <span className="text-muted-foreground italic">(Página sin texto OCR legible)</span>
                          )}
                        </div>
                      </div>

                      {/* Selector de Acción */}
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold mr-1">Acción a realizar:</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={config.modo === 'existente' ? 'default' : 'outline'}
                            onClick={() => setModo(pagina.id, 'existente')}
                            className="h-8 text-xs gap-1.5"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Asignar a tipo existente
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={config.modo === 'nuevo' ? 'default' : 'outline'}
                            onClick={() => setModo(pagina.id, 'nuevo')}
                            className="h-8 text-xs gap-1.5"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Crear tipo nuevo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={config.modo === 'descartar' ? 'destructive' : 'outline'}
                            onClick={() => setModo(pagina.id, 'descartar')}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Descartar página
                          </Button>
                        </div>

                        {/* Campos específicos según el modo */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                          {config.modo === 'existente' && (
                            <div className="flex-1 max-w-md">
                              <Select
                                value={config.tipoId || (tipos.length > 0 ? String(tipos[0].id) : '')}
                                onValueChange={(val) => setTipoId(pagina.id, val)}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Seleccione un tipo de documento..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {tipos.map((t) => (
                                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                                      {t.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {config.modo === 'nuevo' && (
                            <div className="flex-1 max-w-md">
                              <Input
                                placeholder="Nombre del nuevo tipo de documento (ej. Acta de Grado)"
                                value={config.nombreNuevo || ''}
                                onChange={(e) => setNombreNuevo(pagina.id, e.target.value)}
                                className="h-9 text-xs"
                              />
                            </div>
                          )}

                          {config.modo === 'descartar' && (
                            <div className="flex-1 text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="text-destructive font-medium">⚠️ Se marcará como descartada</span>
                              <span>y no volverá a aparecer en las colas de revisión.</span>
                            </div>
                          )}

                          {/* Botón Confirmar */}
                          <div className="sm:ml-auto">
                            <Button
                              type="button"
                              onClick={() => handleConfirmar(pagina)}
                              disabled={
                                estaGuardando ||
                                (config.modo === 'nuevo' && !(config.nombreNuevo || '').trim())
                              }
                              className="h-9 px-4 text-xs font-semibold gap-1.5 shadow-sm"
                              variant={config.modo === 'descartar' ? 'destructive' : 'default'}
                            >
                              {estaGuardando ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Confirmar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Error de fila */}
                        {errorFila && (
                          <p className="text-xs text-destructive font-medium mt-1">
                            {errorFila}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Botón Cargar Más */}
          {hayMas && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={cargarMas} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Cargar más páginas residuales
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal visor OCR completo */}
      <Dialog open={Boolean(paginaParaModal)} onOpenChange={(open) => !open && setPaginaParaModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              <span>
                Texto OCR Completo — {paginaParaModal?.pdfOrigen} (Pág. {paginaParaModal?.nroPaginaEnPdf})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Lote: {paginaParaModal?.loteNombre || `#${paginaParaModal?.loteId}`} · Estado: {paginaParaModal?.estado}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 rounded-md bg-muted/40 border font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
            {paginaParaModal?.textoOcr ? (
              paginaParaModal.textoOcr
            ) : (
              <span className="text-muted-foreground italic">No se extrajo ningún texto OCR para esta página.</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Alias export para retrocompatibilidad
export const RevisionSinAgrupar = RevisionSinAgruparPage
