import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_LOTE } from '@graphql/queries/lote.queries'
import { ROUTES } from '@config/routes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  CheckCircle2,
  ArrowLeft,
  Upload,
  Calendar,
  Layers,
  Printer,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react'
import { Documento, Pagina } from '@app-types/documento.types'
import { EstadoDocumentoBadge } from '../../revision/components/EstadoDocumentoBadge/EstadoDocumentoBadge'

export function LoteDetallePage() {
  const { loteId } = useParams<{ loteId: string }>()
  const navigate = useNavigate()

  const { data, loading, error } = useQuery(GET_LOTE, {
    variables: { id: loteId },
    fetchPolicy: 'network-only',
  })

  const lote = data?.lote

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando detalle del lote...</span>
      </div>
    )
  }

  if (error || !lote) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-semibold text-sm">Lote no disponible</div>
            <div className="text-xs">
              {error?.message || 'No se encontró el lote especificado o no pertenece a su unidad.'}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}>
          Volver a Subida
        </Button>
      </div>
    )
  }

  const docs: Documento[] = lote.documentos || []
  const pagsDuplicadas: Pagina[] = (lote.paginas || []).filter((p: Pagina) => p.estado === 'duplicada')

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Barra superior con navegación */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}
            className="gap-1 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Subida
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Lote #{lote.id}</h1>
              <Badge
                variant="secondary"
                className="bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 text-xs gap-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {lote.estado}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {lote.nombreArchivoOriginal}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lote.estado === 'pendiente_nombres' && (
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.LOTES.AGRUPAR(lote.id))}
              className="gap-1.5 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              Agrupar páginas
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.DOCUMENTOS.SUBIR)}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Subir otro archivo
          </Button>
        </div>
      </div>

      {/* Resumen del Lote */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Total Páginas</span>
            <div className="text-2xl font-bold">{lote.totalPaginas}</div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Grupos Detectados</span>
            <div className="text-2xl font-bold">{lote.totalGrupos}</div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Documentos Creados</span>
            <div className="text-2xl font-bold text-primary">{docs.length}</div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Fecha de Procesamiento</span>
            <div className="text-xs font-medium flex items-center gap-1 mt-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {lote.createdAt ? new Date(lote.createdAt).toLocaleDateString() : 'Hoy'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Páginas Duplicadas detectadas por pHash */}
      {pagsDuplicadas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-destructive flex items-center gap-1.5">
              <Copy className="h-4 w-4" />
              Páginas Duplicadas Excluidas ({pagsDuplicadas.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {pagsDuplicadas.map((p: Pagina) => (
              <Card key={p.id} className="border border-destructive/30 bg-destructive/5">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold">Pág. #{p.nroPaginaEnPdf}</span>
                    <EstadoDocumentoBadge estado="duplicada" />
                  </div>
                  {p.phash && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate" title={p.phash}>
                      pHash: {p.phash}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                    {p.textoOcr || '(Sin texto OCR)'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Documentos Confirmados */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Documentos Confirmados</h2>
        {docs.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border rounded-lg">
            No se han generado documentos confirmados todavía para este lote.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {docs.map((doc: Documento) => {
              const pags: Pagina[] = doc.paginas || []
              return (
                <Card key={doc.id} className="border hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{doc.nombreFinal || `Documento #${doc.id}`}</span>
                        </div>
                        {doc.tipoDocumento && (
                          <div className="text-xs font-medium text-muted-foreground">
                            Tipo: <span className="text-foreground">{doc.tipoDocumento.nombre}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {doc.esDobleCara ? (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                            Doble cara
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {pags.length} pág{pags.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Lista de páginas del documento */}
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                      <span className="font-medium">Páginas físicas:</span>
                      {pags.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                          Pág. {p.nroPaginaEnPdf}
                        </Badge>
                      ))}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/api/documents/${doc.id}/file/`, '_blank')}
                        className="h-7 text-xs gap-1"
                      >
                        <Printer className="h-3 w-3" />
                        Ver / Imprimir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
